ARG VERSION=7.0.1-0048
ARG MESH_VERSION=latest

FROM ghcr.io/ylianst/meshcentral:${MESH_VERSION} AS meshcentral-runtime
FROM ghcr.io/zammad/zammad:${VERSION}

USER root

# MeshCtrl is used by the ITSM to query agent data and perform the approved
# remote power actions. Keep its runtime inside the Zammad image so it is not
# coupled to Node.js packages installed on the AWS host.
RUN if command -v apt-get >/dev/null 2>&1; then \
      apt-get update && \
      apt-get install -y --no-install-recommends nodejs && \
      rm -rf /var/lib/apt/lists/*; \
    elif command -v apk >/dev/null 2>&1; then \
      apk add --no-cache nodejs; \
    else \
      echo 'No supported package manager found to install Node.js.' >&2; exit 1; \
    fi

COPY --from=meshcentral-runtime /opt/meshcentral/node_modules/meshcentral/meshctrl.js /opt/geimser-meshctrl/meshctrl.js
COPY --from=meshcentral-runtime /opt/meshcentral/node_modules/minimist /opt/geimser-meshctrl/node_modules/minimist
COPY --from=meshcentral-runtime /opt/meshcentral/node_modules/ws /opt/geimser-meshctrl/node_modules/ws

ENV GEIMSER_MESHCTRL_PATH=/opt/geimser-meshctrl/meshctrl.js

USER zammad

COPY --chown=zammad:zammad branding/geimser.css /opt/zammad/public/assets/geimser.css
COPY --chown=zammad:zammad branding/geimser.js /opt/zammad/public/assets/geimser.js
COPY --chown=zammad:zammad branding/fonts/ /opt/zammad/public/assets/geimser-fonts/
COPY --chown=zammad:zammad branding/geimser-logo.png /opt/zammad/public/assets/images/geimser-logo.png
COPY --chown=zammad:zammad branding/geimser-logo-mark.png /opt/zammad/public/assets/images/geimser-logo-mark.png
COPY --chown=zammad:zammad branding/layouts/application.html.erb /opt/zammad/app/views/layouts/application.html.erb
COPY --chown=zammad:zammad branding/controllers/geimser_mesh_login_controller.rb /opt/zammad/app/controllers/geimser_mesh_login_controller.rb
COPY --chown=zammad:zammad branding/controllers/geimser_secure_secrets_controller.rb /opt/zammad/app/controllers/geimser_secure_secrets_controller.rb
COPY --chown=zammad:zammad branding/jobs/geimser_ticket_closure_mail_job.rb /opt/zammad/app/jobs/geimser_ticket_closure_mail_job.rb
COPY --chown=zammad:zammad branding/jobs/geimser_ticket_resolution_notice_mail_job.rb /opt/zammad/app/jobs/geimser_ticket_resolution_notice_mail_job.rb
COPY --chown=zammad:zammad branding/views/geimser_ticket_closure_mailer/ /opt/zammad/app/views/geimser_ticket_closure_mailer/
COPY --chown=zammad:zammad branding/routes/geimser_mesh_login.rb /opt/zammad/config/routes/zz_geimser_mesh_login.rb
COPY --chown=zammad:zammad branding/initializers/geimser_content_security_policy.rb /opt/zammad/config/initializers/zz_geimser_content_security_policy.rb
COPY --chown=zammad:zammad branding/initializers/geimser_mesh_cmdb.rb /opt/zammad/config/initializers/zz_geimser_mesh_cmdb.rb
COPY --chown=zammad:zammad branding/initializers/geimser_rbac.rb /opt/zammad/config/initializers/zz_geimser_rbac.rb
COPY --chown=zammad:zammad branding/initializers/geimser_secure_secrets.rb /opt/zammad/config/initializers/zz_geimser_secure_secrets.rb
COPY --chown=zammad:zammad branding/initializers/geimser_sessions_csrf.rb /opt/zammad/config/initializers/zz_geimser_sessions_csrf.rb
COPY --chown=zammad:zammad branding/initializers/geimser_sessions_login.rb /opt/zammad/config/initializers/zz_geimser_sessions_login.rb
COPY --chown=zammad:zammad branding/initializers/geimser_session_cookie.rb /opt/zammad/config/initializers/zz_geimser_session_cookie.rb
COPY --chown=zammad:zammad branding/initializers/geimser_ticket_closure.rb /opt/zammad/config/initializers/zz_geimser_ticket_closure.rb
COPY --chown=zammad:zammad branding/initializers/geimser_ticket_overviews.rb /opt/zammad/config/initializers/zz_geimser_ticket_overviews.rb
COPY --chown=zammad:zammad branding/initializers/geimser_user_temporary_password.rb /opt/zammad/config/initializers/zz_geimser_user_temporary_password.rb
COPY --chown=zammad:zammad branding/initializers/geimser_email_notifications.rb /opt/zammad/config/initializers/zz_geimser_email_notifications.rb
COPY --chown=zammad:zammad scripts/configure_geimser.rb /opt/zammad/contrib/geimser/configure_geimser.rb

RUN ruby -e 'path = "/opt/zammad/app/controllers/sessions_controller.rb"; source = File.read(path); old = "request.env['\''rack.session.options'\''][:expire_after] = 1.year if params[:remember_me]\n\n    # Mark"; new = "request.env['\''rack.session.options'\''][:expire_after] = 1.year if params[:remember_me]\n\n    current_user_set(user, type)\n\n    # Mark"; raise "Zammad session login patch already applied" if source.include?("current_user_set(user, type)\n\n    # Mark"); raise "Zammad session login patch target not found" unless source.include?(old); File.write(path, source.sub(old, new))'
