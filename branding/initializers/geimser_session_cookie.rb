# Keep classic Zammad sessions stable behind the public HTTPS reverse proxy.
# Browsers reject SameSite=None cookies without Secure, so local HTTP must use
# Lax while production HTTPS can use None for reverse-proxy/iframe flows.
if ENV.fetch('ZAMMAD_HTTP_TYPE', nil) == 'https'
  Rails.application.config.session_options[:same_site] = :none
  Rails.application.config.session_options[:secure] = true
else
  Rails.application.config.session_options[:same_site] = :lax
  Rails.application.config.session_options[:secure] = false
end

Rails.application.config.to_prepare do
  next unless defined?(Session)

  Session.singleton_class.prepend(
    Module.new do
      def secure_flag?
        return true if ENV.fetch('ZAMMAD_HTTP_TYPE', nil) == 'https'

        super
      end
    end,
  )
end
