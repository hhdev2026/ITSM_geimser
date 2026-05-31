require 'base64'
require 'cgi'
require 'json'
require 'openssl'
require 'securerandom'
require 'uri'

class GeimserMeshLoginController < ApplicationController
  before_action :authentication_check

  def show
    key = mesh_login_key
    return render plain: 'Remote access is not configured.', status: :service_unavailable if key.blank?

    login = mesh_login_token(key)
    target = mesh_target_url(login)

    redirect_to target, allow_other_host: true
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
end

Rails.application.routes.append do
  get '/geimser/mesh/login', to: 'geimser_mesh_login#show'
end
