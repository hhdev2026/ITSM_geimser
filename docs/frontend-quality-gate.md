# Frontend quality gate

Every frontend release must be validated by profile and viewport before deployment.
Passing one admin screenshot is not enough.

## Automated checks

```bash
./scripts/check_frontend_safety.sh
git diff --check
node --check branding/geimser.js
ruby -c branding/controllers/geimser_mesh_login_controller.rb
```

## Profile matrix

| Profile | Required views |
| --- | --- |
| Public | Login, password reset |
| Customer | Dashboard, profile menu, create ticket, ticket detail |
| Agent | Dashboard, profile menu, overview, create ticket, ticket detail, remote support |
| Admin | All agent views, users, users CMDB, CMDB integration, settings |

## Acceptance criteria

- Sidebar is the only element marked with `.geimser-nav-surface`.
- Customer never sees or reaches administrative CMDB or remote-access features.
- Profile menu stays floating, fully visible, scrollable, and clickable.
- No fixed Geimser element covers native actions or content.
- Dashboard, ticket, profile, and administration layouts keep their native width and flow.
- Text, icons, inputs, and images are visible in light and dark themes.
- No horizontal page scroll at `390x844`, `768x1024`, `1280x720`, or `1440x900`.
- Browser console has no new errors and every visible action opens the expected view.

## Release evidence

Save one screenshot per profile/view combination and record:

- route
- viewport
- profile
- light or dark theme
- visible issue count
- functional failure count
