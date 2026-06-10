require 'base64'
require 'json'
require 'openssl'
require 'securerandom'
require 'set'
require 'uri'

class GeimserMeshLoginController < ApplicationController
  before_action :authentication_check
  before_action :require_internal_user!
  before_action :require_admin!, only: %i[show]

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

  def search
    return render json: [], status: :unauthorized if !valid_cmdb_token?

    query = params[:query].to_s.downcase.strip
    records = GeimserMeshCmdb.sync
    records = GeimserMeshCmdb.filter_records(records, 'query' => query) if query.present?

    render json: records.first(20).map { |record| cmdb_search_result(record) }
  end

  private

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
    node_token = query['gotonode'].presence || query['node'].to_s.split('/', 3).last
    return URI.parse('/') if node_token.blank? || node_token !~ /\A[A-Za-z0-9@$_=-]+\z/

    URI.parse("/?#{URI.encode_www_form(
      'gotonode' => node_token,
      'viewmode' => '11',
      'hide' => '15',
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
