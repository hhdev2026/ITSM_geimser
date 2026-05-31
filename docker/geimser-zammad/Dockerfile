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
