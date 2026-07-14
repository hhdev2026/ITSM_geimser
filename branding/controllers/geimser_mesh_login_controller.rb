require 'base64'
require 'erb'
require 'json'
require 'net/http'
require 'openssl'
require 'securerandom'
require 'set'
require 'uri'

class GeimserMeshLoginController < ApplicationController
  before_action :authentication_check, except: %i[bot_login demo demo_session search]
  before_action :require_internal_user!, except: %i[bot_login bot_session demo demo_session search]
  before_action :require_admin!, only: %i[show]
  # The signed, short-lived demo ticket is the authorization proof for this
  # endpoint. Zammad replaces Rails' default callback with verify_csrf_token.
  skip_before_action :verify_csrf_token, only: %i[demo_session], raise: false

  def show
    key = mesh_login_key
    return render plain: 'Remote access is not configured.', status: :service_unavailable if key.blank?

    redirect_to mesh_target_url(mesh_login_token(key)), allow_other_host: true
  end

  def assets
    records = GeimserMeshCmdb.sync
    render json: {
      synced_at: Time.now.utc.iso8601,
      count: records.length,
      assets: records.map { |record| serialize_remote_asset(record) },
    }
  end

  def users
    assets = GeimserMeshCmdb.sync.map { |record| serialize_remote_asset(record) }
    platform_index = user_platform_index
    users = geimser_users(platform_index).map do |user|
      serialize_cmdb_user(user, platform_index[user.login.to_s.downcase], assets)
    end

    summary = {
      total: users.length,
      with_assets: users.count { |user| user[:assets_count].positive? },
      without_assets: users.count { |user| user[:assets_count].zero? },
      online: users.count { |user| user[:state] == 'online' },
      offline: users.count { |user| user[:state] == 'offline' },
      platforms: users.map { |user| user.dig(:platform, :servicio) }.compact_blank.uniq.length,
      orphan_assets: orphan_assets(users, assets).length,
    }

    render json: {
      synced_at: Time.now.utc.iso8601,
      summary: summary,
      users: users,
      orphan_assets: orphan_assets(users, assets),
    }
  end

  def inventory_map
    GeimserInventoryWorkspace.ensure_table

    records = GeimserInventoryWorkspace.order(:code).to_a
    users_by_id = User.where(id: records.filter_map(&:user_id)).index_by(&:id)
    assets_by_id = GeimserMeshCmdb::RemoteAsset.where(id: records.filter_map(&:asset_id)).index_by(&:id)

    render json: records.map { |record| serialize_inventory_workspace(record, users_by_id[record.user_id], assets_by_id[record.asset_id]) }
  end

  def inventory_csrf
    render json: { csrf_token: form_authenticity_token }
  end

  def inventory_options
    GeimserInventoryWorkspace.ensure_table

    render json: {
      users: inventory_users.map { |user| serialize_inventory_user_option(user) },
      assets: GeimserMeshCmdb.sync.map { |record| serialize_inventory_asset_option(record) },
    }
  end

  def recommend_asset
    user = User.find_by(id: params[:user_id])
    return render json: {} if user.blank?

    assets = GeimserMeshCmdb.sync
    platform = user_platform_index[user.login.to_s.downcase] || user_platform_index[user.email.to_s.downcase]
    matched = assets_for_user(user, platform, assets.map { |record| serialize_remote_asset(record) }).first
    record = assets.find { |asset| asset.mesh_node_id == matched[:id] } if matched.present?

    render json: record.present? ? { asset_id: record.id } : {}
  end

  def recommend_user
    asset = GeimserMeshCmdb::RemoteAsset.find_by(id: params[:asset_id])
    return render json: {} if asset.blank?

    user = matched_inventory_user_for_asset(asset)
    if user.present?
      return render json: {
        user_id: user.id,
        name: inventory_user_name(user),
      }
    end

    pc_username = remote_asset_pc_username(asset)
    render json: pc_username.present? ? { pc_username: pc_username } : {}
  end

  def assign_inventory_map
    GeimserInventoryWorkspace.ensure_table

    code = params[:code].to_s.strip
    return render json: { error: 'code is required' }, status: :bad_request if code.blank?

    user_id = params[:user_id].presence&.to_i
    asset_id = params[:asset_id].presence&.to_i
    user_id = nil if user_id.present? && !User.exists?(id: user_id)
    asset_id = nil if asset_id.present? && !GeimserMeshCmdb::RemoteAsset.exists?(id: asset_id)

    record = GeimserInventoryWorkspace.find_or_initialize_by(code: code)
    record.assign_attributes(
      user_id: user_id,
      asset_id: asset_id,
      temp_user_name: user_id.present? ? nil : params[:temp_user_name].to_s.strip.presence,
    )
    record.save!

    render json: serialize_inventory_workspace(
      record,
      user_id.present? ? User.find_by(id: user_id) : nil,
      asset_id.present? ? GeimserMeshCmdb::RemoteAsset.find_by(id: asset_id) : nil,
    )
  end

  def bot_session
    render json: bot_identity_payload
  end

  def bot_login
    origin = safe_bot_origin
    return render_bot_login_redirect(origin) if current_user.blank?

    payload = bot_identity_payload.merge(type: 'geimser:itsm-identity')
    nonce = content_security_policy_nonce

    render html: [
      '<!doctype html>',
      '<html lang="es">',
      '<head>',
      '<meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width, initial-scale=1">',
      '<title>Conectando con Mesa de Ayuda</title>',
      '<style>',
      'body{margin:0;min-height:100vh;display:grid;place-items:center;background:#07101d;color:#e5eefb;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}',
      '.box{max-width:360px;padding:28px;text-align:center}',
      '.mark{display:inline-grid;width:44px;height:44px;place-items:center;border:1px solid rgba(85,244,255,.28);border-radius:12px;background:rgba(85,244,255,.08);color:#55f4ff;font-weight:800;margin-bottom:14px}',
      'h1{font-size:18px;margin:0 0 8px}p{font-size:13px;line-height:1.5;margin:0;color:#9fb1c8}',
      '</style>',
      '</head>',
      '<body>',
      '<main class="box">',
      '<span class="mark">S</span>',
      '<h1>Login ITSM confirmado</h1>',
      '<p>Volviendo al asistente de soporte.</p>',
      '</main>',
      "<script#{nonce.present? ? " nonce=\"#{ERB::Util.html_escape(nonce)}\"" : ''}>",
      '(function(){',
      "var origin=#{origin.to_json};",
      "var payload=#{payload.to_json};",
      'if(window.opener&&!window.opener.closed){window.opener.postMessage(payload,origin);}',
      'setTimeout(function(){window.close();},650);',
      '}());',
      '</script>',
      '</body>',
      '</html>',
    ].join.html_safe, layout: false
  end

  def demo
    nonce = content_security_policy_nonce
    render html: [
      '<!doctype html>',
      '<html lang="es">',
      '<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">',
      '<title>Geimser ITSM · Demo</title>',
      '<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#07101d;color:#e7f4ff;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.box{text-align:center}.spinner{width:26px;height:26px;margin:0 auto 14px;border:2px solid rgba(255,255,255,.12);border-top-color:#27d8f4;border-radius:50%;animation:s .9s linear infinite}strong,span{display:block}strong{font-size:15px}span{margin-top:7px;color:rgba(255,255,255,.42);font-size:12px}@keyframes s{to{transform:rotate(360deg)}}</style>',
      '</head><body><main class="box"><i class="spinner"></i><strong>Abriendo ITSM real</strong><span id="status">Validando acceso comercial…</span></main>',
      "<script#{nonce.present? ? " nonce=\"#{ERB::Util.html_escape(nonce)}\"" : ''}>",
      '(async function(){',
      'var ticket=new URLSearchParams(window.location.hash.slice(1)).get("ticket");',
      'var status=document.getElementById("status");',
      'if(!ticket){status.textContent="El acceso demo no es válido.";return;}',
      'try{var response=await fetch("/geimser/demo/session",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({ticket:ticket})});var payload=await response.json();if(!response.ok||!payload.redirect){throw new Error(payload.error||"No fue posible abrir ITSM.")}window.location.replace(payload.redirect);}catch(error){status.textContent=error.message||"No fue posible abrir ITSM.";}',
      '}());',
      '</script></body></html>',
    ].join.html_safe, layout: false
  end

  def demo_session
    payload = JSON.parse(request.raw_post.presence || '{}')
    return render json: { error: 'Acceso demo expirado.' }, status: :unauthorized unless valid_demo_ticket?(payload['ticket'])

    user = User.find_by(login: ENV.fetch('GEIMSER_DEMO_USER', 'demo@geimser.local'))
    return render json: { error: 'La cuenta demo no está configurada.' }, status: :service_unavailable if user.blank?

    current_user_set(user, 'geimser_demo')
    session[:persistent] = true
    session[:authentication_type] = 'geimser_demo'
    request.env['rack.session.options'][:expire_after] = 1.hour
    render json: { redirect: '/#dashboard' }
  rescue JSON::ParserError
    render json: { error: 'Solicitud inválida.' }, status: :bad_request
  end

  def search
    return render json: [], status: :unauthorized if !valid_cmdb_token?

    query = params[:query].to_s.downcase.strip
    records = GeimserMeshCmdb.sync
    records = GeimserMeshCmdb.filter_records(records, 'query' => query) if query.present?

    render json: records.first(20).map { |record| cmdb_search_result(record) }
  end

  private

  def valid_demo_ticket?(ticket)
    return false if ticket.blank?

    uri = URI.parse(ENV.fetch('GEIMSER_DEMO_VERIFY_URL', 'https://www.geimser.cl/api/experience/demo-ticket'))
    request = Net::HTTP::Post.new(uri)
    request['Content-Type'] = 'application/json'
    request.body = { product: 'itsm', ticket: ticket.to_s }.to_json
    response = Net::HTTP.start(uri.host, uri.port, use_ssl: uri.scheme == 'https', open_timeout: 4, read_timeout: 6) do |http|
      http.request(request)
    end
    response.is_a?(Net::HTTPSuccess) && JSON.parse(response.body)['valid'] == true
  rescue StandardError
    false
  end

  def mesh_login_key
    key = ENV['MESH_LOGIN_KEY'].to_s.strip
    return if key !~ /\A[0-9a-f]{160}\z/i

    [key].pack('H*')
  end

  def mesh_login_token(key)
    payload = {
      u:    "user//#{ENV.fetch('MESH_LOGIN_USER', 'admin')}",
      a:    3,
      time: Time.now.to_i,
    }

    cipher = OpenSSL::Cipher.new('aes-256-gcm')
    cipher.encrypt
    iv = SecureRandom.random_bytes(12)
    cipher.key = key.byteslice(0, 32)
    cipher.iv = iv

    encrypted = cipher.update(payload.to_json) + cipher.final
    Base64.strict_encode64(iv + cipher.auth_tag + encrypted).tr('+/', '@$')
  end

  def mesh_target_url(login)
    uri = URI.parse(mesh_public_url)
    destination = safe_next_uri
    uri.path = destination.path
    uri.query = URI.encode_www_form(URI.decode_www_form(destination.query.to_s) + [['login', login]])
    uri.to_s
  end

  def mesh_public_url
    public_url = ENV['MESH_PUBLIC_URL'].to_s.strip
    public_url = "https://#{ENV['MESH_HOSTNAME']}" if public_url.blank? && ENV['MESH_HOSTNAME'].present?
    public_url = 'https://remoto.geimser.cl' if public_url.blank?
    public_url = "https://#{public_url}" if public_url !~ %r{\Ahttps?://}i

    uri = URI.parse(public_url)
    itsm_hosts = [
      request.host,
      ENV['ZAMMAD_FQDN'].to_s.split(':').first,
      'itsm.geimser.cl',
    ].compact_blank

    if uri.host.blank? || itsm_hosts.include?(uri.host)
      uri.host = 'remoto.geimser.cl'
    end

    uri.scheme = 'https'
    uri.path = ''
    uri.query = nil
    uri.fragment = nil
    uri.to_s.sub(%r{/\z}, '')
  rescue URI::InvalidURIError
    'https://remoto.geimser.cl'
  end

  def safe_next_uri
    requested = params[:next].to_s
    return URI.parse('/') if requested.blank?

    uri = URI.parse(requested)
    return URI.parse('/') if uri.host.present? || uri.scheme.present?

    path = uri.path.presence || '/'
    return URI.parse('/meshagents') if path == '/meshagents'
    return URI.parse('/') if path != '/'

    query = URI.decode_www_form(uri.query.to_s).to_h.slice('node', 'gotonode', 'viewmode', 'hide', 'geimserautoconnect')
    node_value = query['node'].presence || query['gotonode'].presence
    return URI.parse('/') if node_value.blank? || node_value !~ %r{\A(?:node//)?[A-Za-z0-9@$_=-]+\z}
    node_value = "node//#{node_value}" unless node_value.start_with?('node//')

    URI.parse("/?#{URI.encode_www_form(
      'node' => node_value,
      'gotonode' => node_value.split('/', 3).last,
      'viewmode' => '11',
      'hide' => '0',
      'geimserautoconnect' => '1',
    )}")
  rescue URI::InvalidURIError, ArgumentError
    URI.parse('/')
  end

  def valid_cmdb_token?
    expected = ENV['GEIMSER_CMDB_TOKEN'].to_s
    return false if expected.blank?

    token = params[:token].to_s.presence || request.authorization.to_s.sub(/\ABearer\s+/i, '')
    ActiveSupport::SecurityUtils.secure_compare(token, expected)
  rescue StandardError
    false
  end

  def bot_identity_payload
    {
      authenticated: true,
      user: serialize_bot_user(current_user),
    }
  end

  def render_bot_login_redirect(origin)
    nonce = content_security_policy_nonce
    render html: [
      '<!doctype html>',
      '<html lang="es">',
      '<head>',
      '<meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width, initial-scale=1">',
      '<title>Login ITSM requerido</title>',
      '<style>',
      'body{margin:0;min-height:100vh;display:grid;place-items:center;background:#07101d;color:#e5eefb;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}',
      '.box{max-width:380px;padding:28px;text-align:center}',
      '.mark{display:inline-grid;width:44px;height:44px;place-items:center;border:1px solid rgba(85,244,255,.28);border-radius:12px;background:rgba(85,244,255,.08);color:#55f4ff;font-weight:800;margin-bottom:14px}',
      'h1{font-size:18px;margin:0 0 8px}p{font-size:13px;line-height:1.5;margin:0 0 18px;color:#9fb1c8}a{display:inline-flex;border-radius:8px;background:#55f4ff;color:#07101d;font-weight:700;padding:10px 14px;text-decoration:none}',
      '</style>',
      '</head>',
      '<body>',
      '<main class="box">',
      '<span class="mark">S</span>',
      '<h1>Inicia sesión en ITSM</h1>',
      '<p>Después del login volveré automáticamente al asistente.</p>',
      '<a href="/#login">Iniciar sesión</a>',
      '</main>',
      "<script#{nonce.present? ? " nonce=\"#{ERB::Util.html_escape(nonce)}\"" : ''}>",
      '(function(){',
      "window.localStorage.setItem('geimserBotReturnOrigin', #{origin.to_json});",
      "window.location.replace('/#login');",
      '}());',
      '</script>',
      '</body>',
      '</html>',
    ].join.html_safe, layout: false
  end

  def serialize_bot_user(user)
    {
      id: user.id,
      login: user.login,
      email: user.email.presence || user.login,
      firstname: user.firstname,
      lastname: user.lastname,
      name: [user.firstname, user.lastname].compact_blank.join(' ').presence || user.email.presence || user.login,
      area: user.organization&.name,
      organization: user.organization&.name,
    }
  end

  def safe_bot_origin
    requested = params[:return_origin].to_s.presence
    allowed = bot_allowed_origins
    return allowed.first if requested.blank?

    uri = URI.parse(requested)
    origin = "#{uri.scheme}://#{uri.host}#{uri.port && ![80, 443].include?(uri.port) ? ":#{uri.port}" : ''}"
    return origin if allowed.include?(origin)

    allowed.first
  rescue URI::InvalidURIError
    allowed.first
  end

  def bot_allowed_origins
    ENV.fetch('GEIMSER_BOT_ORIGINS', 'https://iabot.geimser.cl,https://botitsm.vercel.app,https://botitsm-atlas-devs-projects.vercel.app,https://botitsm-git-main-atlas-devs-projects.vercel.app,http://localhost:3000')
      .split(',')
      .map(&:strip)
      .reject(&:blank?)
  end

  def require_internal_user!
    return if current_user_has_permission?('ticket.agent') || current_user_has_permission?('admin')

    render plain: 'Forbidden', status: :forbidden
  end

  def require_admin!
    return if current_user_has_permission?('admin')

    render plain: 'Forbidden', status: :forbidden
  end

  def current_user_has_permission?(permission)
    user = current_user
    return false if user.blank?

    user.permissions?(permission)
  end

  def cmdb_search_result(record)
    title = record.name.presence || record.hostname.presence || record.mesh_node_id
    label = [
      title,
      record.group_name.presence,
      record.os_name.presence,
      record.status.presence,
    ].compact.join(' | ')

    {
      value: record.mesh_node_id,
      label: label,
      id: record.id,
      session_url: record.session_url,
    }
  end

  def inventory_users
    base_scope = User.where(active: true)
      .where.not(id: 1)
      .where.not(login: [nil, '', '-'])
      .where.not("LOWER(login) LIKE '%zammad.org'")

    geimser_scope = base_scope.where("LOWER(login) LIKE '%@geimser.local' OR LOWER(email) LIKE '%@geimser.local'")
    records = geimser_scope.order(:firstname, :lastname, :login).limit(2_000).to_a
    return records if records.present?

    base_scope.order(:firstname, :lastname, :login).limit(2_000).to_a
  end

  def serialize_inventory_workspace(record, user, asset)
    details = asset.present? ? remote_asset_details(asset) : {}
    {
      id: record.id,
      code: record.code,
      room: inventory_room_for(record.code),
      seat_label: record.code.to_s.split('-', 2).last,
      user_id: user&.id,
      asset_id: asset&.id,
      user_name: user.present? ? inventory_user_name(user) : record.temp_user_name,
      user_email: user&.email,
      user_role: user&.roles&.map(&:name)&.join(', '),
      user_area: user&.organization&.name,
      asset_hostname: asset&.name.presence || asset&.hostname,
      asset_ip: asset&.ip_address,
      asset_status: inventory_asset_status(asset),
      asset_brand: details[:manufacturer],
      asset_model: details[:model],
      asset_remote_url: asset&.session_url,
      asset_node_id: asset&.mesh_node_id,
    }
  end

  def serialize_inventory_user_option(user)
    {
      id: user.id,
      name: inventory_user_name(user),
      email: user.email,
      area: user.organization&.name,
    }
  end

  def serialize_inventory_asset_option(record)
    details = remote_asset_details(record)
    title = record.name.presence || record.hostname.presence || record.mesh_node_id
    {
      id: record.id,
      node_id: record.mesh_node_id,
      name: title,
      hostname: record.hostname,
      ip: record.ip_address,
      status: inventory_asset_status(record),
      raw_status: record.status,
      occupant: remote_asset_pc_username(record),
      session_url: record.session_url,
      brand: details[:manufacturer],
      model: details[:model],
    }
  end

  def inventory_user_name(user)
    [user.firstname, user.lastname].compact_blank.join(' ').presence || user.email.presence || user.login
  end

  def inventory_room_for(code)
    prefix = code.to_s.split('-', 2).first
    return 'Sala KREA (1er Piso)' if prefix == 'KREA'
    return 'Sala Huerfanos 2do Piso' if prefix == 'HUERFANOS'
    return 'SALA MERCED 2do Piso' if prefix == 'MERCED'

    prefix
  end

  def inventory_asset_status(asset)
    return if asset.blank?

    asset.status == 'online' ? 'Activo' : 'Fuera de Linea'
  end

  def matched_inventory_user_for_asset(asset)
    serialized_asset = serialize_remote_asset(asset)
    platform_index = user_platform_index

    inventory_users.find do |user|
      platform = platform_index[user.login.to_s.downcase] || platform_index[user.email.to_s.downcase]
      assets_for_user(user, platform, [serialized_asset]).present?
    end
  end

  def remote_asset_pc_username(record)
    raw = JSON.parse(record.raw.presence || '{}')
    candidates = [
      raw['user'],
      raw['username'],
      raw['users'],
      raw['upnusers'],
      raw['lusers'],
      raw.dig('sysinfo', 'users'),
      raw.dig('sysinfo', 'upnusers'),
    ].flatten.compact_blank.map(&:to_s)

    candidates
      .map { |value| value.split(/[\\\/]/).last.split('@').first.strip }
      .find { |value| value.length >= 3 }
  rescue StandardError
    nil
  end

  def serialize_remote_asset(record)
    {
      id: record.mesh_node_id,
      mesh_group_id: record.mesh_group_id,
      group: record.group_name,
      name: record.name,
      hostname: record.hostname,
      os: record.os_name,
      ip: record.ip_address,
      status: record.status,
      last_seen_at: record.last_seen_at&.iso8601,
      session_url: record.session_url,
      updated_at: record.updated_at&.iso8601,
      details: remote_asset_details(record),
    }
  end

  def geimser_users(platform_index)
    logins = platform_index.keys
    scope = User.where(active: true)
    scope = scope.where('LOWER(login) IN (?) OR LOWER(email) IN (?)', logins, logins) if logins.present?

    records = scope.order(:firstname, :lastname, :login).limit(2_000).to_a
    return records if records.present? && logins.present?

    User.where(active: true).where("LOWER(email) LIKE '%@geimser.local' OR LOWER(login) LIKE '%@geimser.local'")
      .order(:firstname, :lastname, :login)
      .limit(2_000)
      .to_a
  end

  def serialize_cmdb_user(user, platform, assets)
    matched_assets = assets_for_user(user, platform, assets)
    state = if matched_assets.any? { |asset| asset[:status] == 'online' }
              'online'
            elsif matched_assets.present?
              'offline'
            else
              'unassigned'
            end

    {
      id: user.id,
      name: [user.firstname, user.lastname].compact_blank.join(' ').presence || user.login,
      firstname: user.firstname,
      lastname: user.lastname,
      login: user.login,
      email: user.email,
      organization: user.organization&.name,
      state: state,
      assets_count: matched_assets.length,
      platform: platform.to_h.slice(:area, :cargo, :cliente, :servicio, :campana, :rut, :reg),
      assets: matched_assets,
    }
  end

  def assets_for_user(user, platform, assets)
    tokens = user_match_tokens(user, platform)
    return [] if tokens.blank?

    strong = assets.select do |asset|
      asset_text = [
        asset[:name],
        asset[:hostname],
        asset[:group],
        asset.dig(:details, :computer_name),
      ].compact.join(' ').downcase

      tokens.any? { |token| token.length >= 4 && asset_text.include?(token) }
    end

    strong.first(5)
  end

  def user_match_tokens(user, platform)
    local = user.login.to_s.split('@').first
    names = [user.firstname, user.lastname, platform.to_h[:nombre_completo]].compact.join(' ')
    [
      local,
      *local.split(/[._-]+/),
      *names.downcase.split(/\W+/),
    ].map { |token| token.to_s.downcase.strip }.select { |token| token.length >= 4 }.uniq
  end

  def orphan_assets(users, assets)
    used_ids = users.flat_map { |user| user[:assets].map { |asset| asset[:id] } }.compact.to_set
    assets.reject { |asset| used_ids.include?(asset[:id]) }
  end

  def user_platform_index
    path = ENV.fetch('GEIMSER_USER_PLATFORM_FILE', '/opt/zammad/storage/geimser_users_platform.json')
    return {} if path.blank? || !File.exist?(path)

    rows = JSON.parse(File.read(path))
    Array(rows).each_with_object({}) do |row, memo|
      data = row.to_h.symbolize_keys.except(:password)
      key = data[:login].presence || data[:email].presence
      memo[key.to_s.downcase] = data if key.present?
    end
  rescue StandardError => error
    Rails.logger.warn("Geimser user platform file ignored: #{error.class}: #{error.message}")
    {}
  end

  def remote_asset_details(record)
    raw = JSON.parse(record.raw.presence || '{}')
    sysinfo = raw['sysinfo'].to_h
    system = sysinfo['system'].to_h
    osinfo = sysinfo['osinfo'].to_h
    agent = raw['agent'].to_h
    network = sysinfo['network'].to_h
    netifs = Array(network['netif']).filter_map do |iface|
      [
        iface['name'].presence || iface['desc'].presence,
        Array(iface['ip']).compact_blank.join(', ').presence,
        iface['mac'].presence,
      ].compact.join(' · ').presence
    end

    {
      mesh_node_id: record.mesh_node_id,
      mesh_group_id: record.mesh_group_id,
      computer_name: system['Name'].presence || raw['host'].presence || record.hostname,
      manufacturer: system['Manufacturer'].presence,
      model: system['Model'].presence,
      serial: system['SerialNumber'].presence || system['Serial'].presence,
      os_caption: osinfo['Caption'].presence || record.os_name,
      os_version: osinfo['Version'].presence,
      os_build: osinfo['BuildNumber'].presence,
      agent_id: agent['id'].presence,
      agent_version: agent['ver'].presence,
      mesh_capabilities: agent['caps'].presence,
      last_address: raw['lastaddr'].presence,
      first_seen_at: GeimserMeshCmdb.time(raw['firstconnect'])&.iso8601,
      last_connect_at: GeimserMeshCmdb.time(raw['lastconnect'])&.iso8601,
      last_ping_at: GeimserMeshCmdb.time(raw['lastping'])&.iso8601,
      network_interfaces: netifs,
    }.compact_blank
  rescue StandardError
    {
      mesh_node_id: record.mesh_node_id,
      mesh_group_id: record.mesh_group_id,
    }.compact_blank
  end
end
