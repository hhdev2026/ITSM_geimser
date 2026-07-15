# frozen_string_literal: true

module GeimserTicketOverviews
  module_function

  def ensure!
    return unless defined?(Overview) && defined?(Ticket::State) && defined?(Role)

    with_database_lock do
      cleanup_duplicate_overviews!

      closed_state_ids = closed_ticket_state_ids
      return if closed_state_ids.blank?

      ensure_overview!(
        link: 'geimser_closed_tickets',
        name: 'Tickets cerrados',
        prio: 1060,
        roles: roles_for(%w[Admin Agent]),
        condition: {
          'ticket.state_id' => {
            'operator' => 'is',
            'value' => closed_state_ids,
          },
        },
        order: {
          'by' => 'updated_at',
          'direction' => 'DESC',
        },
        view: {
          'd' => %w[title customer group state owner updated_at],
          's' => %w[title customer group state owner updated_at],
          'm' => %w[number title customer group state owner updated_at],
          'view_mode_default' => 's',
        },
      )

      ensure_overview!(
        link: 'geimser_my_closed_tickets',
        name: 'Mis tickets cerrados',
        prio: 1110,
        roles: roles_for(%w[Customer]),
        condition: {
          'ticket.state_id' => {
            'operator' => 'is',
            'value' => closed_state_ids,
          },
          'ticket.customer_id' => {
            'operator' => 'is',
            'pre_condition' => 'current_user.id',
          },
        },
        order: {
          'by' => 'updated_at',
          'direction' => 'DESC',
        },
        view: {
          'd' => %w[title customer state updated_at],
          's' => %w[number title state updated_at],
          'm' => %w[number title state updated_at],
          'view_mode_default' => 's',
        },
      )
    end
  rescue => e
    Rails.logger.error "GeimserTicketOverviews failed: #{e.class}: #{e.message}"
  end

  def with_database_lock
    connection = ActiveRecord::Base.connection
    lock_key = 34_415_106

    if connection.adapter_name.downcase.include?('postgres')
      connection.execute("SELECT pg_advisory_lock(#{lock_key})")
      yield
    else
      yield
    end
  ensure
    if defined?(connection) && connection&.adapter_name&.downcase&.include?('postgres')
      connection.execute("SELECT pg_advisory_unlock(#{lock_key})")
    end
  end

  def closed_ticket_state_ids
    ids = Ticket::State.joins(:state_type)
                       .where(ticket_state_types: { name: 'closed' })
                       .pluck(:id)
    ids.presence || Array(Ticket::State.find_by(name: 'closed')&.id).compact
  end

  def roles_for(names)
    Role.where(name: names, active: true).to_a
  end

  def cleanup_duplicate_overviews!
    {
      'geimser_closed_tickets' => 'Tickets cerrados',
      'geimser_my_closed_tickets' => 'Mis tickets cerrados',
    }.each do |link, name|
      records = Overview.where(name: name).order(:id).to_a
      next if records.size <= 1

      keep = records.find { |overview| overview.link == link } || records.first
      records.reject { |overview| overview.id == keep.id }.each(&:destroy!)
      next if keep.link == link

      keep.update!(link: link, updated_by_id: 1)
    end
  end

  def ensure_overview!(link:, name:, prio:, roles:, condition:, order:, view:)
    return if roles.blank?

    overview = Overview.find_by(link: link) || Overview.find_or_initialize_by(name: name)
    overview.assign_attributes(
      name: name,
      link: link,
      prio: prio,
      condition: condition,
      order: order,
      view: view,
      active: true,
      created_by_id: overview.created_by_id.presence || 1,
      updated_by_id: 1,
    )
    overview.roles = roles
    overview.save!
  end
end

Rails.application.config.after_initialize do
  GeimserTicketOverviews.ensure!
end
