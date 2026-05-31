# Zammad 7 can reject the public sign-in flow behind the HTTPS front proxy when
# the SPA has no persisted session yet. Keep CSRF protection everywhere else,
# but let the unauthenticated bootstrap/login endpoints issue the first session.
Rails.application.config.to_prepare do
  next unless defined?(SessionsController)

  SessionsController.skip_before_action(
    :verify_authenticity_token,
    only: %i[show create],
    raise: false,
  )

  SessionsController.skip_before_action(
    :verify_csrf_token,
    only: %i[show create],
    raise: false,
  )
end
