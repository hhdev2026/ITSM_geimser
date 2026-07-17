# frozen_string_literal: true

require 'erb'

class GeimserTicketClosureAudit < ActiveRecord::Base
  self.table_name = 'geimser_ticket_closure_audits'

  CLOSURE_TYPES = %w[manual automatic].freeze
  EMAIL_STATUSES = %w[pending sent skipped failed].freeze

  belongs_to :ticket, class_name: 'Ticket', optional: true
  belongs_to :closed_by, class_name: 'User', optional: true

  before_validation :set_defaults

  def self.ensure_table
    connection = ActiveRecord::Base.connection
    return if connection.table_exists?(table_name)

    connection.create_table(table_name) do |table|
      table.integer :ticket_id, null: false
      table.string :ticket_number
      table.string :closure_type, null: false
      table.string :trigger, null: false
      table.datetime :closed_at, null: false
      table.integer :closed_by_user_id
      table.datetime :email_sent_at
      table.string :email_status, null: false, default: 'pending'
      table.text :email_error
      table.timestamps null: false
    end

    connection.add_index table_name, :ticket_id, name: 'idx_geimser_ticket_closure_ticket'
    connection.add_index table_name, %i[ticket_id closed_at], name: 'idx_geimser_ticket_closure_event'
    connection.add_index table_name, :closure_type, name: 'idx_geimser_ticket_closure_type'
    connection.add_index table_name, :email_status, name: 'idx_geimser_ticket_closure_email'
  end

  def set_defaults
    self.closure_type = 'manual' unless CLOSURE_TYPES.include?(closure_type.to_s)
    self.email_status = 'pending' unless EMAIL_STATUSES.include?(email_status.to_s)
    self.trigger = trigger.presence || 'manual_state_change'
    self.closed_at ||= Time.current
  end
end

module GeimserTicketClosure
  module_function

  AUTO_CLOSE_AFTER = 24.hours
  RESOLUTION_PREFERENCE_KEY = 'geimser_resolved_at'
  RESOLUTION_NOTICE_SENT_KEY = 'geimser_resolution_notice_sent_at'

  POSITIVE_CONFIRMATION = /
    \b(
      solucionad[oa]s?|
      resuelt[oa]s?|
      funciona(?:ndo)?|
      qued[oó]\s+(?:ok|bien|list[oa])|
      todo\s+(?:ok|bien|list[oa])|
      pueden\s+cerrar|
      cerrar\s+(?:el\s+)?ticket|
      conforme|
      gracias.*(?:solucion|resolv)
    )\b
  /ix

  NEGATIVE_CONFIRMATION = /
    \b(
      no\s+(?:se\s+)?(?:solucion|resolv|funciona)|
      sigue\s+(?:fallando|igual|el\s+problema)|
      contin[uú]a\s+(?:fallando|el\s+problema)|
      persiste|
      aun\s+no
    )\b
  /ix

  def ensure_setup!
    GeimserTicketClosureAudit.ensure_table
    ensure_scheduler!
  end

  def ensure_scheduler!
    Scheduler.create_or_update(
      name:          'Geimser: cerrar tickets resueltos inactivos',
      method:        'GeimserTicketClosure.process_auto_closures!',
      period:        10.minutes,
      prio:          0,
      active:        true,
      updated_by_id: 1,
      created_by_id: 1,
    )
  end

  def pending_close_state
    Ticket::State.find_by(name: ['pending close', 'resolved', 'resuelto'])
  end

  def closed_state
    Ticket::State.active.by_category(:closed).first || Ticket::State.find_by(name: 'closed')
  end

  def pending_close_state_id
    pending_close_state&.id
  end

  def closed_state_id
    closed_state&.id
  end

  def pending_close?(ticket)
    pending_close_state_id.present? && ticket.state_id.to_i == pending_close_state_id.to_i
  end

  def closed?(ticket)
    state = ticket.state || Ticket::State.find_by(id: ticket.state_id)
    return false if state.blank?

    Ticket::StateType.lookup(id: state.state_type_id)&.name == 'closed'
  end

  def mark_resolved_deadline(ticket)
    return unless pending_close?(ticket)

    ticket.preferences ||= {}
    ticket.preferences[RESOLUTION_PREFERENCE_KEY] ||= Time.current.iso8601

    deadline = Time.current + AUTO_CLOSE_AFTER
    ticket.pending_time = deadline if ticket.pending_time.blank? || ticket.pending_time > deadline
  end

  def enqueue_resolution_notice!(ticket)
    return unless pending_close?(ticket)

    should_enqueue = false
    ticket.with_lock do
      ticket.reload
      return unless pending_close?(ticket)

      ticket.preferences ||= {}
      return if ticket.preferences[RESOLUTION_NOTICE_SENT_KEY].present?

      ticket.preferences[RESOLUTION_NOTICE_SENT_KEY] = Time.current.iso8601
      ticket.save!(validate: false)
      should_enqueue = true
    end

    return unless should_enqueue

    add_resolution_notice_note(ticket.reload)
    GeimserTicketResolutionNoticeMailJob.perform_later(ticket.id)
  end

  def process_auto_closures!
    ensure_setup!
    state_id = pending_close_state_id
    return [] if state_id.blank?

    closed = []
    Ticket.where(state_id: state_id).find_each(batch_size: 100) do |ticket|
      next unless auto_close_due?(ticket)
      next if customer_replied_after_resolution?(ticket)

      close_ticket!(
        ticket: ticket,
        closure_type: 'automatic',
        trigger: 'inactivity_24h',
        actor_user_id: 1,
      )
      closed << ticket.id
    end
    closed
  end

  def auto_close_due?(ticket)
    resolved_at = resolved_at(ticket)
    return false if resolved_at.blank?

    resolved_at <= AUTO_CLOSE_AFTER.ago
  end

  def resolved_at(ticket)
    raw = ticket.preferences.try(:[], RESOLUTION_PREFERENCE_KEY)
    return Time.zone.parse(raw) if raw.present?

    ticket.pending_time.present? ? ticket.pending_time - AUTO_CLOSE_AFTER : ticket.updated_at
  rescue ArgumentError, TypeError
    ticket.updated_at
  end

  def customer_replied_after_resolution?(ticket)
    resolved_time = resolved_at(ticket)
    return false if resolved_time.blank?

    customer_sender = Ticket::Article::Sender.lookup(name: 'Customer')
    return false if customer_sender.blank?

    Ticket::Article
      .where(ticket_id: ticket.id, sender_id: customer_sender.id)
      .where(internal: [false, nil])
      .where('created_at > ?', resolved_time)
      .exists?
  end

  def close_from_customer_confirmation(article)
    return if article.internal
    return unless customer_article?(article)
    return unless communication_article?(article)
    return unless confirmation_text?(article.body)

    ticket = Ticket.find_by(id: article.ticket_id)
    return if ticket.blank? || closed?(ticket)

    close_ticket!(
      ticket: ticket,
      closure_type: 'manual',
      trigger: 'customer_confirmation',
      actor_user_id: article.created_by_id.presence || article.origin_by_id.presence || ticket.customer_id,
    )
  end

  def customer_article?(article)
    Ticket::Article::Sender.lookup(id: article.sender_id)&.name == 'Customer'
  end

  def communication_article?(article)
    Ticket::Article::Type.lookup(id: article.type_id)&.communication
  end

  def confirmation_text?(body)
    text = body.to_s.html2text.downcase
    return false if text.match?(NEGATIVE_CONFIRMATION)

    text.match?(POSITIVE_CONFIRMATION)
  end

  def close_ticket!(ticket:, closure_type:, trigger:, actor_user_id:)
    state = closed_state
    return if state.blank?

    ticket.with_lock do
      ticket.reload
      return if closed?(ticket)

      UserInfo.current_user_id = actor_user_id.presence || 1 if defined?(UserInfo)
      ticket.state_id = state.id
      ticket.updated_by_id = actor_user_id.presence || 1
      ticket.preferences ||= {}
      ticket.preferences['geimser_closure_trigger'] = trigger
      ticket.save!
    ensure
      UserInfo.current_user_id = nil if defined?(UserInfo)
    end

    record_closure!(
      ticket: ticket.reload,
      closure_type: closure_type,
      trigger: trigger,
      actor_user_id: actor_user_id.presence || 1,
      enqueue_mail: true,
    )
  end

  def record_closure!(ticket:, closure_type:, trigger:, actor_user_id:, enqueue_mail:)
    ensure_setup!
    closed_at = ticket.last_close_at || ticket.close_at || Time.current

    audit = GeimserTicketClosureAudit
      .where(ticket_id: ticket.id)
      .where(closed_at: (closed_at - 2.seconds)..(closed_at + 2.seconds))
      .first
    return audit if audit.present?

    audit = GeimserTicketClosureAudit.create!(
      ticket_id: ticket.id,
      ticket_number: ticket.number,
      closure_type: closure_type,
      trigger: trigger,
      closed_at: closed_at,
      closed_by_user_id: actor_user_id,
      email_status: 'pending',
    )

    add_internal_audit_note(ticket, audit)
    GeimserTicketClosureMailJob.perform_later(audit.id) if enqueue_mail
    audit
  end

  def add_internal_audit_note(ticket, audit)
    sender = Ticket::Article::Sender.find_by(name: 'System')
    type = Ticket::Article::Type.find_by(name: 'note')
    return if sender.blank? || type.blank?

    body = audit.closure_type == 'automatic' ?
      "Ticket cerrado automaticamente por falta de respuesta durante 24 horas." :
      "Ticket cerrado por confirmacion del usuario o cierre manual."

    Ticket::Article.create!(
      ticket_id: ticket.id,
      content_type: 'text/plain',
      body: body,
      internal: true,
      sender: sender,
      type: type,
      created_by_id: audit.closed_by_user_id.presence || 1,
      updated_by_id: audit.closed_by_user_id.presence || 1,
      preferences: {
        geimser_closure_audit_id: audit.id,
        geimser_closure_type: audit.closure_type,
      },
    )
  rescue StandardError => error
    Rails.logger.warn("Geimser ticket closure audit note skipped: #{error.class}: #{error.message}")
  end

  def add_resolution_notice_note(ticket)
    sender = Ticket::Article::Sender.find_by(name: 'System')
    type = Ticket::Article::Type.find_by(name: 'note')
    return if sender.blank? || type.blank?

    Ticket::Article.create!(
      ticket_id: ticket.id,
      content_type: 'text/plain',
      body: 'Se envio aviso al cliente: si no responde en 24 horas despues de marcar el ticket como resuelto, se cerrara automaticamente.',
      internal: true,
      sender: sender,
      type: type,
      created_by_id: 1,
      updated_by_id: 1,
      preferences: {
        geimser_resolution_notice: true,
      },
    )
  rescue StandardError => error
    Rails.logger.warn("Geimser ticket resolution notice note skipped: #{error.class}: #{error.message}")
  end

  module Mailer
    module_function

    def deliver!(audit)
      ticket = Ticket.find_by(id: audit.ticket_id)
      recipient = ticket&.customer
      if ticket.blank? || recipient.blank? || recipient.email.blank?
        return audit.update!(email_status: 'skipped', email_error: 'Sin cliente o correo de destino.')
      end

      body = render_body(audit, ticket, recipient)
      subject = "Ticket ##{ticket.number} cerrado - Geimser ITSM"
      delivered = NotificationFactory::Mailer.deliver(
        recipient: recipient,
        subject: subject,
        body: body,
        content_type: 'text/html',
      )

      audit.update!(
        email_status: delivered ? 'sent' : 'failed',
        email_sent_at: delivered ? Time.current : nil,
        email_error: delivered ? nil : 'No hay canal Email::Notification activo o el envio fue rechazado.',
      )
    rescue StandardError => error
      audit.update!(email_status: 'failed', email_error: "#{error.class}: #{error.message}".truncate(1000))
      raise
    end

    def deliver_resolution_notice!(ticket_id)
      ticket = Ticket.find_by(id: ticket_id)
      recipient = ticket&.customer
      return false if ticket.blank? || recipient.blank? || recipient.email.blank?

      body = render_resolution_notice_body(ticket, recipient)
      subject = "Ticket ##{ticket.number} resuelto - cierre automatico en 24 horas"
      NotificationFactory::Mailer.deliver(
        recipient: recipient,
        subject: subject,
        body: body,
        content_type: 'text/html',
      )
    end

    def render_body(audit, ticket, recipient)
      template = audit.closure_type == 'automatic' ? 'automatic' : 'manual'
      path = Rails.root.join('app/views/geimser_ticket_closure_mailer', "ticket_closed_#{template}.html.erb")
      ERB.new(path.read).result_with_hash(
        ticket: ticket,
        audit: audit,
        recipient: recipient,
        closed_at: localized_time(audit.closed_at, recipient),
        summary: ticket_summary(ticket),
        h: ERB::Util.method(:html_escape),
      )
    end

    def render_resolution_notice_body(ticket, recipient)
      path = Rails.root.join('app/views/geimser_ticket_closure_mailer', 'ticket_resolution_notice.html.erb')
      ERB.new(path.read).result_with_hash(
        ticket: ticket,
        recipient: recipient,
        deadline: localized_time(GeimserTicketClosure.resolution_deadline(ticket), recipient),
        summary: ticket_summary(ticket),
        h: ERB::Util.method(:html_escape),
      )
    end

    def localized_time(value, recipient)
      timezone = recipient.preferences.try(:[], 'timezone').presence || Setting.get('timezone_default').presence || 'America/Santiago'
      value.in_time_zone(timezone).strftime('%d-%m-%Y %H:%M')
    rescue StandardError
      value.to_s
    end

    def ticket_summary(ticket)
      last_customer_article = ticket.articles
        .where(sender_id: Ticket::Article::Sender.lookup(name: 'Customer')&.id)
        .reorder(created_at: :desc)
        .first
      source = last_customer_article&.body.presence || ticket.title
      source.to_s.html2text.squish.truncate(500)
    end
  end

  def resolution_deadline(ticket)
    resolved_at(ticket) + AUTO_CLOSE_AFTER
  end
end

module GeimserTicketClosureTicketPatch
  extend ActiveSupport::Concern

  included do
    before_update :geimser_set_pending_close_deadline
    after_commit :geimser_send_resolution_notice, on: :update
    after_commit :geimser_record_manual_closure, on: :update
  end

  private

  def geimser_set_pending_close_deadline
    return unless will_save_change_to_state_id?

    GeimserTicketClosure.mark_resolved_deadline(self)
  end

  def geimser_send_resolution_notice
    return unless saved_change_to_state_id?
    return unless GeimserTicketClosure.pending_close?(self)

    GeimserTicketClosure.enqueue_resolution_notice!(self)
  rescue StandardError => error
    Rails.logger.warn("Geimser ticket resolution notice skipped: #{error.class}: #{error.message}")
  end

  def geimser_record_manual_closure
    return unless saved_change_to_state_id?
    return unless GeimserTicketClosure.closed?(self)

    GeimserTicketClosure.record_closure!(
      ticket: self,
      closure_type: preferences.try(:[], 'geimser_closure_trigger') == 'inactivity_24h' ? 'automatic' : 'manual',
      trigger: preferences.try(:[], 'geimser_closure_trigger').presence || 'manual_state_change',
      actor_user_id: updated_by_id.presence || 1,
      enqueue_mail: true,
    )
  end
end

module GeimserTicketClosureArticlePatch
  extend ActiveSupport::Concern

  included do
    after_commit :geimser_close_ticket_when_customer_confirms, on: :create
  end

  private

  def geimser_close_ticket_when_customer_confirms
    GeimserTicketClosure.close_from_customer_confirmation(self)
  rescue StandardError => error
    Rails.logger.warn("Geimser customer-confirmed ticket closure skipped: #{error.class}: #{error.message}")
  end
end

Rails.application.config.to_prepare do
  Ticket.include GeimserTicketClosureTicketPatch unless Ticket < GeimserTicketClosureTicketPatch
  Ticket::Article.include GeimserTicketClosureArticlePatch unless Ticket::Article < GeimserTicketClosureArticlePatch
end

Rails.application.config.after_initialize do
  GeimserTicketClosure.ensure_setup!
rescue StandardError => error
  Rails.logger.warn("Geimser ticket closure setup skipped: #{error.class}: #{error.message}")
end
