# frozen_string_literal: true

module GeimserEmailNotifications
  module_function

  def configure!
    account = Channel
      .where(area: 'Email::Account', active: true)
      .find { |channel| smtp_outbound?(channel) }
    return if account.blank?

    notification = Channel.where(area: 'Email::Notification').order(active: :desc, id: :asc).first ||
      Channel.new(area: 'Email::Notification', created_by_id: 1)

    notification.options = { outbound: account.options.with_indifferent_access[:outbound] }
    notification.active = true
    notification.updated_by_id = 1
    notification.created_by_id ||= 1
    notification.save!

    Channel.where(area: 'Email::Notification').where.not(id: notification.id).update_all(active: false, updated_by_id: 1, updated_at: Time.current)

    Setting.set('notification_sender', ENV['ZAMMAD_NOTIFICATION_SENDER'].presence || '"Geimser ITSM" <soporte@geimser.cl>')
    Setting.set('fqdn', configured_fqdn)
    Setting.set('http_type', configured_http_type)
    Setting.set('send_no_auto_response_reg_exp', no_auto_response_regexp)
    Setting.set('ui_ticket_create_default_type', 'email-out')
    Setting.set('ui_ticket_create_available_types', %w[email-out phone-in phone-out])
    disable_local_mailbox_notifications!
  rescue => e
    Rails.logger.warn("Geimser email notification setup skipped: #{e.class}: #{e.message}")
  end

  def smtp_outbound?(channel)
    outbound = channel.options.with_indifferent_access[:outbound]
    outbound.present? &&
      outbound[:adapter].to_s == 'smtp' &&
      outbound.dig(:options, :host).present? &&
      outbound.dig(:options, :user).present?
  end

  def configured_fqdn
    ENV['ZAMMAD_FQDN'].presence ||
      Setting.get('fqdn').presence ||
      'localhost:8080'
  end

  def configured_http_type
    ENV['ZAMMAD_HTTP_TYPE'].presence ||
      Setting.get('http_type').presence ||
      'http'
  end

  def no_auto_response_regexp
    base = Setting.get('send_no_auto_response_reg_exp').presence ||
      '(mailer-daemon|postmaster|abuse|root|noreply|noreply.+?|no-reply|no-reply.+?)@.+?'
    return base if base.include?('geimser\\.local')

    "(#{base})|(.+@geimser\\.local)"
  end

  def disable_local_mailbox_notifications!
    User
      .where(active: true)
      .where("LOWER(email) LIKE '%@geimser.local'")
      .find_each do |user|
        preferences = user.preferences || {}
        matrix = preferences.dig('notification_config', 'matrix')
        next if matrix.blank?

        changed = false
        matrix.each_value do |config|
          channel = config['channel']
          next unless channel&.key?('email') && channel['email'] != false

          channel['email'] = false
          changed = true
        end
        next unless changed

        user.preferences = preferences
        user.updated_by_id = 1
        user.save!
      end
  end
end

Rails.application.config.after_initialize do
  GeimserEmailNotifications.configure!
end
