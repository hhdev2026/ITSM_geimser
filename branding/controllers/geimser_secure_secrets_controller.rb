require 'erb'
require 'json'

class GeimserSecureSecretsController < ApplicationController
  before_action :authentication_check, except: %i[public_show public_metadata reveal]
  before_action :require_internal_user!, except: %i[public_show public_metadata reveal]
  before_action :set_no_store_headers, only: %i[public_show public_metadata reveal]
  skip_before_action :verify_csrf_token, only: %i[public_metadata reveal], raise: false

  def index
    GeimserSecureSecret.ensure_table
    GeimserSecureSecret.expire_stale!

    scope = current_user_has_permission?('admin') ? GeimserSecureSecret.all : GeimserSecureSecret.where(created_by_user_id: current_user.id)
    records = scope.order(created_at: :desc).limit(200).to_a
    users = User.where(id: records.filter_map(&:created_by_user_id)).index_by(&:id)

    render json: {
      key_configured: GeimserSecureSecret.key_configured?,
      records: records.map { |record| serialize_secret_record(record, users[record.created_by_user_id]) },
    }
  end

  def create
    GeimserSecureSecret.ensure_table
    return render_key_missing unless GeimserSecureSecret.key_configured?

    record, token = GeimserSecureSecret.create_secret!(
      user: current_user,
      secret: params[:secret],
      secret_type: params[:secret_type],
      description: params[:description],
      expires_in_seconds: params[:expires_in_seconds],
      max_views: params[:max_views],
      request: request,
    )

    render json: {
      record: serialize_secret_record(record, current_user, include_link: true, token: token),
    }, status: :created
  rescue ArgumentError => error
    render json: { error: error.message }, status: :unprocessable_entity
  end

  def destroy
    GeimserSecureSecret.ensure_table
    record = GeimserSecureSecret.find_by(id: params[:id])
    return render json: { error: 'No encontrado.' }, status: :not_found if record.blank?
    return render json: { error: 'Forbidden' }, status: :forbidden unless can_manage?(record)

    record.soft_delete!(user: current_user, request: request)
    render json: { record: serialize_secret_record(record, current_user) }
  end

  def public_show
    set_no_store_headers
    token = params[:token].to_s
    nonce = content_security_policy_nonce

    render html: public_secret_html(token: token, nonce: nonce).html_safe, layout: false
  end

  def public_metadata
    GeimserSecureSecret.ensure_table
    record = public_record
    if record&.expired_now?
      record.expire!(request: request)
      record = nil
    end

    if record&.active_for_link?
      return render json: {
        available: true,
        secret_type: GeimserSecureSecret::SECRET_TYPES[record.secret_type] || 'Secreto',
        description: record.description,
        expires_at: record.expires_at&.iso8601,
        max_views: record.max_views,
      }
    end

    render json: {
      available: false,
      message: 'Este secreto ya fue leído, expiró o fue eliminado.',
    }, status: :not_found
  end

  def reveal
    return render_key_missing unless GeimserSecureSecret.key_configured?

    secret = GeimserSecureSecret.consume!(token: params[:token], request: request)
    render json: {
      secret: secret,
      message: 'Guárdalo ahora: este contenido no podrá volver a consultarse.',
    }
  rescue ActiveRecord::RecordNotFound
    render json: {
      error: 'Este secreto ya fue leído, expiró o fue eliminado.',
    }, status: :not_found
  rescue ArgumentError => error
    render json: { error: error.message }, status: :service_unavailable
  end

  private

  def public_record
    GeimserSecureSecret.find_by(public_token_hash: GeimserSecureSecret.token_hash(params[:token].to_s))
  end

  def serialize_secret_record(record, user = nil, include_link: false, token: nil)
    status = record.expired_now? && record.status == 'active' ? 'expired' : record.status
    payload = {
      id: record.id,
      description: record.description,
      secret_type: record.secret_type,
      secret_type_label: GeimserSecureSecret::SECRET_TYPES[record.secret_type] || 'Otro',
      created_by: user_label(user),
      created_at: record.created_at&.iso8601,
      expires_at: record.expires_at&.iso8601,
      max_views: record.max_views,
      view_count: record.view_count,
      status: status,
      active: status == 'active' && record.active_for_link?,
    }

    payload[:link] = public_link(token) if include_link && token.present?
    payload
  end

  def public_link(token)
    "#{request.base_url}/secure-secrets/s/#{ERB::Util.url_encode(token)}"
  end

  def user_label(user)
    return 'Sistema' if user.blank?

    [user.firstname, user.lastname].compact_blank.join(' ').presence || user.login || user.email
  end

  def can_manage?(record)
    return true if current_user_has_permission?('admin')

    record.created_by_user_id.to_i == current_user.id.to_i
  end

  def require_internal_user!
    return if geimser_module_access_allowed?

    render plain: 'Forbidden', status: :forbidden
  end

  def current_user_has_permission?(permission)
    user = current_user
    return false if user.blank?

    user.permissions?(permission)
  end

  def render_key_missing
    render json: {
      error: 'GEIMSER_SECURE_SECRETS_KEY no está configurada. Define una clave Base64 de 32 bytes para habilitar Secretos Seguros.',
    }, status: :service_unavailable
  end

  def set_no_store_headers
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
    response.headers['Pragma'] = 'no-cache'
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['Referrer-Policy'] = 'no-referrer'
    response.headers['X-Robots-Tag'] = 'noindex, nofollow'
  end

  def public_secret_html(token:, nonce:)
    csrf = form_authenticity_token
    escaped_token = ERB::Util.html_escape(token)
    script_nonce = nonce.present? ? " nonce=\"#{ERB::Util.html_escape(nonce)}\"" : ''

    [
      '<!doctype html>',
      '<html lang="es">',
      '<head>',
      '<meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width,initial-scale=1">',
      '<meta name="robots" content="noindex,nofollow">',
      "<meta name=\"csrf-token\" content=\"#{ERB::Util.html_escape(csrf)}\">",
      '<title>Secreto Seguro - Geimser ITSM</title>',
      '<style>',
      'body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0e1320;color:#eef3fb;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}',
      '.shell{width:min(720px,calc(100vw - 32px));border:1px solid rgba(124,192,255,.35);border-radius:14px;background:#161d2e;box-shadow:0 24px 70px rgba(0,0,0,.42);overflow:hidden}',
      '.head{display:flex;align-items:center;gap:14px;padding:22px 24px;border-bottom:1px solid rgba(148,163,184,.18)}',
      '.head img{width:42px;height:42px;object-fit:contain}.head strong{display:block;font-size:18px}.head span{display:block;margin-top:3px;color:#9fb1c8;font-size:13px}',
      '.body{padding:24px;display:grid;gap:18px}.notice{padding:14px 16px;border-radius:10px;background:rgba(95,173,242,.12);color:#cfe8ff;border:1px solid rgba(95,173,242,.25)}',
      '.meta{display:grid;gap:8px;color:#c2cddd}.meta b{color:#eef3fb}.secret{display:none;white-space:pre-wrap;word-break:break-word;max-height:300px;overflow:auto;padding:16px;border-radius:10px;background:#0b1220;border:1px solid rgba(148,163,184,.24);color:#fff}',
      '.actions{display:flex;gap:12px;flex-wrap:wrap}.btn{border:0;border-radius:8px;padding:12px 18px;font-weight:800;cursor:pointer}.primary{background:#5fadf2;color:#06101c}.secondary{background:#212b41;color:#eef3fb}.danger{color:#ffb4ad}',
      '</style>',
      '</head>',
      '<body>',
      '<main class="shell">',
      '<section class="head">',
      '<img src="/assets/images/geimser-logo-mark.png" alt="Geimser">',
      '<div><strong>Contenido protegido</strong><span>Geimser ITSM - Secretos Seguros</span></div>',
      '</section>',
      '<section class="body">',
      '<div id="state" class="notice">Validando disponibilidad del enlace...</div>',
      '<div id="meta" class="meta"></div>',
      '<div id="secret" class="secret"></div>',
      '<div class="actions">',
      '<button id="reveal" class="btn primary" type="button" disabled>Mostrar secreto</button>',
      '<button id="copy" class="btn secondary" type="button" hidden>Copiar secreto</button>',
      '</div>',
      '</section>',
      '</main>',
      "<script#{script_nonce}>",
      '(function(){',
      "var token='#{escaped_token}';",
      'var csrf=document.querySelector("meta[name=csrf-token]").content;',
      'var state=document.getElementById("state");var meta=document.getElementById("meta");var reveal=document.getElementById("reveal");var copy=document.getElementById("copy");var box=document.getElementById("secret");',
      'function text(value){return value==null?"":String(value)}',
      'fetch("/api/secure-secrets/public/"+encodeURIComponent(token),{credentials:"same-origin",cache:"no-store"}).then(function(r){return r.json().then(function(j){if(!r.ok)throw j;return j})}).then(function(data){state.textContent="Este contenido solo se podrá visualizar una vez.";meta.innerHTML="<div><b>Tipo:</b> "+text(data.secret_type)+"</div>"+(data.description?"<div><b>Descripción:</b> "+text(data.description).replace(/[<>&]/g,function(c){return {\"<\":\"&lt;\",\">\":\"&gt;\",\"&\":\"&amp;\"}[c]})+"</div>":"")+"<div><b>Expira:</b> "+new Date(data.expires_at).toLocaleString()+"</div>";reveal.disabled=false;}).catch(function(error){state.className="notice danger";state.textContent=error.message||"Este secreto ya fue leído, expiró o fue eliminado.";});',
      'reveal.addEventListener("click",function(){reveal.disabled=true;fetch("/api/secure-secrets/public/"+encodeURIComponent(token)+"/reveal",{method:"POST",credentials:"same-origin",cache:"no-store",headers:{"Content-Type":"application/json","X-CSRF-Token":csrf}}).then(function(r){return r.json().then(function(j){if(!r.ok)throw j;return j})}).then(function(data){box.style.display="block";box.textContent=data.secret;state.textContent=data.message;copy.hidden=false;}).catch(function(error){state.className="notice danger";state.textContent=error.error||error.message||"No fue posible revelar el secreto.";});});',
      'copy.addEventListener("click",function(){navigator.clipboard&&navigator.clipboard.writeText(box.textContent).then(function(){copy.textContent="Copiado";setTimeout(function(){copy.textContent="Copiar secreto";},1600);});});',
      '}());',
      '</script>',
      '</body>',
      '</html>',
    ].join
  end

  def public_secret_html(token:, nonce:)
    csrf = form_authenticity_token
    json_token = token.to_s.to_json
    script_nonce = nonce.present? ? " nonce=\"#{ERB::Util.html_escape(nonce)}\"" : ''

    [
      '<!doctype html>',
      '<html lang="es">',
      '<head>',
      '<meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width,initial-scale=1">',
      '<meta name="robots" content="noindex,nofollow">',
      "<meta name=\"csrf-token\" content=\"#{ERB::Util.html_escape(csrf)}\">",
      '<title>Secreto Seguro - Geimser ITSM</title>',
      '<link rel="stylesheet" href="/assets/geimser-secure-secret-public.css">',
      '</head>',
      '<body>',
      '<main class="shell">',
      '<section class="head">',
      '<img src="/assets/images/geimser-logo-mark.png" alt="Geimser">',
      '<div><strong>Contenido protegido</strong><span>Geimser ITSM - Secretos Seguros</span></div>',
      '</section>',
      '<section class="body">',
      '<div id="state" class="notice">Validando disponibilidad del enlace...</div>',
      '<div id="meta" class="meta"></div>',
      '<div id="secret" class="secret"></div>',
      '<div class="actions">',
      '<button id="reveal" class="btn primary" type="button" disabled>Mostrar secreto</button>',
      '<button id="copy" class="btn secondary" type="button" hidden>Copiar secreto</button>',
      '</div>',
      '</section>',
      '</main>',
      "<script#{script_nonce}>",
      '(function(){',
      "var token=#{json_token};",
      'var csrf=document.querySelector("meta[name=csrf-token]").content;',
      'var state=document.getElementById("state");',
      'var meta=document.getElementById("meta");',
      'var reveal=document.getElementById("reveal");',
      'var copy=document.getElementById("copy");',
      'var box=document.getElementById("secret");',
      'function text(value){return value==null?"":String(value)}',
      'function addMeta(label,value){var row=document.createElement("div");var strong=document.createElement("b");strong.textContent=label+": ";row.appendChild(strong);row.appendChild(document.createTextNode(text(value)));meta.appendChild(row)}',
      'function json(response){return response.json().catch(function(){return {}}).then(function(payload){if(!response.ok){throw payload}return payload})}',
      'fetch("/api/secure-secrets/public/"+encodeURIComponent(token),{credentials:"same-origin",cache:"no-store"}).then(json).then(function(data){state.textContent="Este contenido solo se podra visualizar una vez.";meta.textContent="";addMeta("Tipo",data.secret_type);if(data.description){addMeta("Descripcion",data.description)}addMeta("Expira",new Date(data.expires_at).toLocaleString());reveal.disabled=false;}).catch(function(error){state.className="notice danger";state.textContent=error.message||"Este secreto ya fue leido, expiro o fue eliminado.";});',
      'reveal.addEventListener("click",function(){reveal.disabled=true;fetch("/api/secure-secrets/public/"+encodeURIComponent(token)+"/reveal",{method:"POST",credentials:"same-origin",cache:"no-store",headers:{"Content-Type":"application/json","X-CSRF-Token":csrf}}).then(json).then(function(data){box.style.display="block";box.textContent=data.secret;state.textContent=data.message||"Guarda este contenido ahora.";copy.hidden=false;}).catch(function(error){state.className="notice danger";state.textContent=error.error||error.message||"No fue posible revelar el secreto.";});});',
      'copy.addEventListener("click",function(){if(!navigator.clipboard)return;navigator.clipboard.writeText(box.textContent).then(function(){copy.textContent="Copiado";setTimeout(function(){copy.textContent="Copiar secreto";},1600);});});',
      '}());',
      '</script>',
      '</body>',
      '</html>',
    ].join
  end
end
