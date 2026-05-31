# Ensure the classic Zammad login persists the authenticated user in the Rails
# session before the SPA starts calling authenticated endpoints.
Rails.application.config.to_prepare do
  next unless defined?(SessionsController)

  SessionsController.class_eval do
    def initiate_session_for(user, type = 'password')
      request.env['rack.session.options'][:expire_after] = 1.year if params[:remember_me]

      current_user_set(user, type)
      session[:persistent] = true
      session[:authentication_type] = type

      user.activity_stream_log('session started', user.id, true)
    end
  end
end
