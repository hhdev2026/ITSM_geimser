require 'base64'
require 'digest'
require 'openssl'
require 'securerandom'

class GeimserSecureSecret < ActiveRecord::Base
  self.table_name = 'geimser_secure_secrets'

  STATUSES = %w[active consumed expired deleted].freeze
  SECRET_TYPES = {
    'password' => 'Contraseña',
    'token' => 'Token',
    'api_key' => 'API Key',
    'code' => 'Código',
    'credential' => 'Credencial',
    'message' => 'Mensaje',
    'other' => 'Otro',
  }.freeze

  before_validation :set_defaults

  class << self
    def ensure_table
      connection = ActiveRecord::Base.connection
      return if connection.table_exists?(table_name)

      connection.create_table(table_name) do |table|
        table.string :public_token_hash, null: false
        table.text :encrypted_payload
        table.string :encryption_nonce
        table.string :secret_type, null: false, default: 'password'
        table.string :description
        table.integer :created_by_user_id
        table.datetime :expires_at, null: false
        table.integer :max_views, null: false, default: 1
        table.integer :view_count, null: false, default: 0
        table.datetime :consumed_at
        table.datetime :deleted_at
        table.datetime :last_viewed_at
        table.string :status, null: false, default: 'active'
        table.timestamps null: false
      end

      connection.add_index table_name, :public_token_hash, unique: true, name: 'idx_geimser_secure_secrets_token'
      connection.add_index table_name, :created_by_user_id, name: 'idx_geimser_secure_secrets_user'
      connection.add_index table_name, :status, name: 'idx_geimser_secure_secrets_status'
      connection.add_index table_name, :expires_at, name: 'idx_geimser_secure_secrets_expires'
    end

    def create_secret!(user:, secret:, secret_type:, description:, expires_in_seconds:, max_views:, request:)
      ensure_table
      key!

      normalized_secret = secret.to_s
      raise ArgumentError, 'El contenido secreto es obligatorio.' if normalized_secret.blank?
      raise ArgumentError, 'El contenido no puede superar 10 KB.' if normalized_secret.bytesize > 10.kilobytes

      token = SecureRandom.urlsafe_base64(32)
      encrypted = encrypt(normalized_secret)
      record = create!(
        public_token_hash: token_hash(token),
        encrypted_payload: encrypted[:payload],
        encryption_nonce: encrypted[:nonce],
        secret_type: SECRET_TYPES.key?(secret_type.to_s) ? secret_type.to_s : 'other',
        description: description.to_s.strip.presence&.truncate(180),
        created_by_user_id: user&.id,
        expires_at: Time.now.utc + normalize_expiration(expires_in_seconds),
        max_views: [[max_views.to_i, 1].max, 5].min,
        view_count: 0,
        status: 'active',
      )

      audit(record, 'created', user: user, request: request)
      [record, token]
    end

    def consume!(token:, request:)
      ensure_table
      key!

      record = find_by(public_token_hash: token_hash(token.to_s))
      unless record
        audit(nil, 'missing_access', request: request)
        raise ActiveRecord::RecordNotFound, 'Este secreto ya fue leído, expiró o fue eliminado.'
      end

      secret = nil
      record.with_lock do
        if record.expired_now?
          record.expire!(request: request)
          raise ActiveRecord::RecordNotFound, 'Este secreto ya fue leído, expiró o fue eliminado.'
        end

        unless record.revealable?
          audit(record, 'reused', request: request)
          raise ActiveRecord::RecordNotFound, 'Este secreto ya fue leído, expiró o fue eliminado.'
        end

        secret = decrypt(payload: record.encrypted_payload, nonce: record.encryption_nonce)
        record.view_count += 1
        record.last_viewed_at = Time.now.utc
        if record.view_count >= record.max_views
          record.status = 'consumed'
          record.consumed_at = Time.now.utc
          record.encrypted_payload = nil
          record.encryption_nonce = nil
        end
        record.save!
        audit(record, 'consumed', request: request)
      end

      secret
    end

    def expire_stale!
      ensure_table

      where(status: 'active')
        .where('expires_at <= ?', Time.now.utc)
        .find_each { |record| record.expire! }
    end

    def token_hash(token)
      Digest::SHA256.hexdigest("geimser-secure-secret:v1:#{token}")
    end

    def key_configured?
      key
      true
    rescue StandardError
      false
    end

    def key!
      key
    end

    def key
      raw = ENV['GEIMSER_SECURE_SECRETS_KEY'].to_s.strip
      raise ArgumentError, 'GEIMSER_SECURE_SECRETS_KEY no está configurada.' if raw.blank?

      decoded = if raw.match?(/\A[0-9a-f]{64}\z/i)
                  [raw].pack('H*')
                else
                  Base64.strict_decode64(raw)
                end
      raise ArgumentError, 'GEIMSER_SECURE_SECRETS_KEY debe tener 32 bytes.' unless decoded.bytesize == 32

      decoded
    rescue ArgumentError
      raise
    rescue StandardError
      raise ArgumentError, 'GEIMSER_SECURE_SECRETS_KEY no tiene formato válido.'
    end

    def encrypt(secret)
      cipher = OpenSSL::Cipher.new('aes-256-gcm')
      cipher.encrypt
      nonce = SecureRandom.random_bytes(12)
      cipher.key = key
      cipher.iv = nonce
      encrypted = cipher.update(secret) + cipher.final
      {
        nonce: Base64.strict_encode64(nonce),
        payload: Base64.strict_encode64(cipher.auth_tag + encrypted),
      }
    end

    def decrypt(payload:, nonce:)
      raw_payload = Base64.strict_decode64(payload.to_s)
      tag = raw_payload.byteslice(0, 16)
      encrypted = raw_payload.byteslice(16..)

      cipher = OpenSSL::Cipher.new('aes-256-gcm')
      cipher.decrypt
      cipher.key = key
      cipher.iv = Base64.strict_decode64(nonce.to_s)
      cipher.auth_tag = tag
      cipher.update(encrypted) + cipher.final
    end

    def normalize_expiration(value)
      allowed = [10.minutes, 30.minutes, 1.hour, 6.hours, 12.hours, 1.day, 3.days, 7.days].map(&:to_i)
      seconds = value.to_i
      allowed.include?(seconds) ? seconds : 1.hour.to_i
    end

    def audit(record, event, user: nil, request: nil)
      Rails.logger.info(
        [
          'GeimserSecureSecret',
          "event=#{event}",
          ("id=#{record.id}" if record),
          ("user_id=#{user.id}" if user),
          ("ip=#{request.remote_ip}" if request),
        ].compact.join(' ')
      )
    rescue StandardError
      nil
    end
  end

  def revealable?
    status == 'active' &&
      deleted_at.blank? &&
      encrypted_payload.present? &&
      encryption_nonce.present? &&
      view_count.to_i < max_views.to_i &&
      !expired_now?
  end

  def expired_now?
    expires_at.present? && expires_at <= Time.now.utc
  end

  def expire!(request: nil)
    update!(
      status: 'expired',
      encrypted_payload: nil,
      encryption_nonce: nil,
    )
    self.class.audit(self, 'expired', request: request)
  end

  def soft_delete!(user: nil, request: nil)
    update!(
      status: 'deleted',
      deleted_at: Time.now.utc,
      encrypted_payload: nil,
      encryption_nonce: nil,
    )
    self.class.audit(self, 'deleted', user: user, request: request)
  end

  def active_for_link?
    status == 'active' && deleted_at.blank? && encrypted_payload.present? && !expired_now?
  end

  def set_defaults
    self.secret_type = 'password' unless SECRET_TYPES.key?(secret_type.to_s)
    self.status = 'active' unless STATUSES.include?(status.to_s)
    self.max_views = [[max_views.to_i, 1].max, 5].min
    self.view_count = [view_count.to_i, 0].max
  end
end

Rails.application.config.after_initialize do
  GeimserSecureSecret.ensure_table
  GeimserSecureSecret.expire_stale!
rescue StandardError => error
  Rails.logger.warn("Geimser secure secrets setup skipped: #{error.class}: #{error.message}")
end
