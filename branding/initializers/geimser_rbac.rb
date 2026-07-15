# frozen_string_literal: true

module GeimserRbac
  extend ActiveSupport::Concern

  def geimser_ticket_only_user?(user = current_user)
    return false if user.blank?
    return false if user.permissions?('admin')

    role_names = Array(user.roles).map { |role| role.name.to_s.downcase }
    restricted_roles = %w[agent client cliente customer]
    (role_names & restricted_roles).any? ||
      user.permissions?('ticket.agent') ||
      user.permissions?('ticket.customer')
  end
  alias geimser_agent_only_user? geimser_ticket_only_user?

  def geimser_module_access_allowed?
    return false if current_user.blank?

    current_user.permissions?('admin')
  end

  def require_geimser_module_access!
    return if geimser_module_access_allowed?

    respond_to do |format|
      format.json { render json: { error: 'Forbidden' }, status: :forbidden }
      format.html { render plain: 'Forbidden', status: :forbidden }
      format.any  { render plain: 'Forbidden', status: :forbidden }
    end
  end
end

Rails.application.config.to_prepare do
  ApplicationController.include GeimserRbac unless ApplicationController < GeimserRbac
end
