# Keep classic Zammad sessions stable behind the public HTTPS reverse proxy.
Rails.application.config.session_options[:same_site] = :none

if ENV.fetch('ZAMMAD_HTTP_TYPE', nil) == 'https'
  Rails.application.config.session_options[:secure] = true
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
