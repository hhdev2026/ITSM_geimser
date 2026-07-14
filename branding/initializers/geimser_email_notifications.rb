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

    Setting.set('notification_sender', '"Geimser ITSM" <soporte@geimser.cl>')
    Setting.set('fqdn', 'itsm.geimser.cl')
    Setting.set('http_type', 'https')
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
end

Rails.application.config.after_initialize do
  GeimserEmailNotifications.configure!
end
