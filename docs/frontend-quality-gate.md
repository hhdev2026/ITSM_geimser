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

The safety script also blocks static regressions that are easy to miss in a
single screenshot:

- Geimser orange cannot be used as foreground text color. Use it as an accent,
  border, or avatar background only when the text on top remains high contrast.
- Legacy `#geimser/cmdb` routes are not allowed.
- A custom `.geimser-cmdb-view` overlay is not allowed; users must see one CMDB
  entry point and one CMDB surface.
- `.geimser-remote-button` is not allowed as a floating global entry point.
  Remote control must be opened from the ticket or CMDB asset context.

## Profile matrix

| Profile | Required views |
| --- | --- |
| Public | Login, password reset |
| Customer | Dashboard, profile menu, create ticket, ticket detail |
| Agent | Dashboard, profile menu, overview, create ticket, ticket detail, remote support |
| Admin | All agent views, users, CMDB integration, settings |

## Acceptance criteria

- Sidebar is the only element marked with `.geimser-nav-surface`.
- Customer never sees or reaches administrative CMDB or remote-access features.
- Profile menu stays floating, fully visible, scrollable, and clickable.
- Avatars remain legible at small sizes: initials/icons have clear contrast,
  stable circular shape, and no cramped lettering.
- Geimser orange is never used as body text, label text, or icon text on light
  surfaces.
- Only one CMDB is visible to the user. Admins use the native CMDB integration
  route `#system/integration/idoit`; there is no duplicate Geimser CMDB overlay.
- No navigation, shortcut, redirect, or close action sends users to
  `#geimser/cmdb`.
- Remote control entry points are contextual to a ticket detail, ticket create
  field, or native CMDB asset detail.
- A floating global remote-support button is not the primary entry point.
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
