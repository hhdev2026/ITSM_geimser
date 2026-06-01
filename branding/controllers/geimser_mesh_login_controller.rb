require 'base64'
require 'json'
require 'openssl'
require 'securerandom'
require 'uri'

class GeimserMeshLoginController < ApplicationController
  before_action :authentication_check
  skip_before_action :authentication_check, only: :search

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
    public_url = ENV.fetch('MESH_PUBLIC_URL') do
      "https://#{ENV.fetch('MESH_HOSTNAME', 'remoto.geimser.cl')}"
    end

    uri = URI.parse(public_url)
    uri.path = safe_next_path
    uri.query = URI.encode_www_form('login' => login)
    uri.to_s
  end

  def safe_next_path
    requested = params[:next].to_s
    return '/' if requested.blank?

    uri = URI.parse(requested)
    return '/' if uri.host.present? || uri.scheme.present?

    uri.path.presence || '/'
  rescue URI::InvalidURIError
    '/'
  end

  def valid_cmdb_token?
    expected = ENV.fetch('GEIMSER_CMDB_TOKEN', 'geimser-cmdb-local')
    token = params[:token].to_s.presence || request.authorization.to_s.sub(/\ABearer\s+/i, '')
    ActiveSupport::SecurityUtils.secure_compare(token, expected)
  rescue StandardError
    false
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
      group: record.group_name,
      name: record.name,
      hostname: record.hostname,
      os: record.os_name,
      ip: record.ip_address,
      status: record.status,
      last_seen_at: record.last_seen_at&.iso8601,
      session_url: record.session_url,
      updated_at: record.updated_at&.iso8601,
    }
  end
end
