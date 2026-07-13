# frozen_string_literal: true

module GeimserUserTemporaryPassword
  TEMPORARY_PASSWORD = ENV.fetch('GEIMSER_GENERIC_USER_PASSWORD', 'GEimser.2026!')
  PREFERENCE_KEY = 'geimser_must_change_password'

  module UsersControllerPatch
    def create_internal
      geimser_force_temporary_password!
      super.tap do
        geimser_mark_created_user_must_change_password if response.status.to_i == 201
      end
    end

    def password_change
      super.tap do
        geimser_clear_password_change_requirement if response.status.to_i == 200
      end
    end

    private

    def geimser_force_temporary_password!
      params[:password] = GeimserUserTemporaryPassword::TEMPORARY_PASSWORD
    end

    def geimser_mark_created_user_must_change_password
      user = geimser_created_user_from_response || geimser_created_user_from_params
      return if user.blank?

      preferences = user.preferences.presence || {}
      preferences[GeimserUserTemporaryPassword::PREFERENCE_KEY] = true
      preferences['geimser_temporary_password_created_at'] = Time.current.iso8601
      user.preferences = preferences
      user.save!
    end

    def geimser_created_user_from_response
      payload = JSON.parse(response.body)
      user_id = payload['id'] || payload.dig('user', 'id')
      User.find_by(id: user_id) if user_id.present?
    rescue JSON::ParserError, TypeError
      nil
    end

    def geimser_created_user_from_params
      login = params[:login].presence || params[:email].presence
      email = params[:email].presence

      User.find_by(login: login) ||
        (email.present? ? User.find_by(email: email) : nil)
    end

    def geimser_clear_password_change_requirement
      return if current_user.blank?

      preferences = current_user.preferences.presence || {}
      return if !preferences[GeimserUserTemporaryPassword::PREFERENCE_KEY]

      preferences[GeimserUserTemporaryPassword::PREFERENCE_KEY] = false
      preferences['geimser_password_changed_at'] = Time.current.iso8601
      current_user.preferences = preferences
      current_user.save!
    end
  end
end

Rails.application.config.to_prepare do
  unless UsersController < GeimserUserTemporaryPassword::UsersControllerPatch
    UsersController.prepend GeimserUserTemporaryPassword::UsersControllerPatch
  end
end
