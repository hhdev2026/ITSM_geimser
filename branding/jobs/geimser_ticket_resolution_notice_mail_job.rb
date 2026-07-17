class GeimserTicketResolutionNoticeMailJob < ApplicationJob
  queue_as :default

  retry_on StandardError, attempts: 3, wait: lambda { |executions| executions * 30.seconds }

  def perform(ticket_id)
    GeimserTicketClosure::Mailer.deliver_resolution_notice!(ticket_id)
  end
end
