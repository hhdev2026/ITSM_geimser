class GeimserTicketClosureMailJob < ApplicationJob
  queue_as :default

  retry_on StandardError, attempts: 3, wait: lambda { |executions| executions * 30.seconds }

  def perform(audit_id)
    audit = GeimserTicketClosureAudit.find_by(id: audit_id)
    return if audit.blank?

    GeimserTicketClosure::Mailer.deliver!(audit)
  end
end
