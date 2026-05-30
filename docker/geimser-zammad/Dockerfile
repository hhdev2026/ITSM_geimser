ARG VERSION=7.0.1-0048
FROM ghcr.io/zammad/zammad:${VERSION}

COPY --chown=zammad:zammad branding/geimser.css /opt/zammad/public/geimser/geimser.css
COPY --chown=zammad:zammad branding/geimser.js /opt/zammad/public/geimser/geimser.js
COPY --chown=zammad:zammad branding/geimser-logo.png /opt/zammad/public/assets/images/geimser-logo.png
COPY --chown=zammad:zammad branding/layouts/application.html.erb /opt/zammad/app/views/layouts/application.html.erb
COPY --chown=zammad:zammad scripts/configure_geimser.rb /opt/zammad/contrib/geimser/configure_geimser.rb
