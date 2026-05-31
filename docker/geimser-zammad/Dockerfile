ARG VERSION=7.0.1-0048
FROM ghcr.io/zammad/zammad:${VERSION}

COPY --chown=zammad:zammad branding/geimser.css /opt/zammad/public/assets/geimser.css
COPY --chown=zammad:zammad branding/geimser.js /opt/zammad/public/assets/geimser.js
COPY --chown=zammad:zammad branding/geimser-logo.png /opt/zammad/public/assets/images/geimser-logo.png
COPY --chown=zammad:zammad branding/layouts/application.html.erb /opt/zammad/app/views/layouts/application.html.erb
COPY --chown=zammad:zammad branding/initializers/geimser_content_security_policy.rb /opt/zammad/config/initializers/zz_geimser_content_security_policy.rb
COPY --chown=zammad:zammad branding/initializers/geimser_sessions_csrf.rb /opt/zammad/config/initializers/zz_geimser_sessions_csrf.rb
COPY --chown=zammad:zammad branding/initializers/geimser_sessions_login.rb /opt/zammad/config/initializers/zz_geimser_sessions_login.rb
COPY --chown=zammad:zammad scripts/configure_geimser.rb /opt/zammad/contrib/geimser/configure_geimser.rb

RUN ruby -e 'path = "/opt/zammad/app/controllers/sessions_controller.rb"; source = File.read(path); old = "request.env['\''rack.session.options'\''][:expire_after] = 1.year if params[:remember_me]\n\n    # Mark"; new = "request.env['\''rack.session.options'\''][:expire_after] = 1.year if params[:remember_me]\n\n    current_user_set(user, type)\n\n    # Mark"; raise "Zammad session login patch already applied" if source.include?("current_user_set(user, type)\n\n    # Mark"); raise "Zammad session login patch target not found" unless source.include?(old); File.write(path, source.sub(old, new))'
