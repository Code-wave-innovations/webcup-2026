---
name: Reset native cursor
overview: "Remove the custom HUD reticle on the film routes and restore the system cursor. The reticle is what makes the pointer feel heavy: it hides the native cursor, draws glowing corner ticks, and lags a ring behind the pointer."
todos:
  - id: unmount-reticle
    content: Remove ReticleCursor from FilmLayout and delete the component and its CSS
    status: completed
  - id: restore-css
    content: Remove html.has-reticle cursor:none rules from index.css
    status: completed
  - id: nova-attr
    content: Remove unused data-cursor="nova" from NovaHitZone and update CLAUDE.md
    status: completed
isProject: false
---

# Reset the cursor to the system pointer

The film shell ([frontend/src/app/FilmLayout.tsx](frontend/src/app/FilmLayout.tsx)) mounts `ReticleCursor`, which on a mouse or trackpad adds `html.has-reticle`. That class in [frontend/src/index.css](frontend/src/index.css) forces `cursor: none` on the whole page. The replacement is a 30px ice-colored sight with a glow, a lagging ring, and a “Bonjour” label over Nova.

## Changes

- Unmount `ReticleCursor` from `FilmLayout` and delete [frontend/src/ui/ReticleCursor.tsx](frontend/src/ui/ReticleCursor.tsx) and [frontend/src/ui/ReticleCursor.module.css](frontend/src/ui/ReticleCursor.module.css).
- Delete the `html.has-reticle` rules in [frontend/src/index.css](frontend/src/index.css) so buttons, links, and the rest use their normal cursors again (pointer, text caret, grab on the explore HUD).
- Drop `data-cursor="nova"` from [frontend/src/experience/nova/NovaHitZone.tsx](frontend/src/experience/nova/NovaHitZone.tsx). Hover and click still make Nova curious and poke it; only the greeting label goes away.
- Update the cursor bullet in [CLAUDE.md](CLAUDE.md) so it no longer describes the reticle.

Touch and pen already kept the system cursor. Inputs, video, and `[data-cursor="native"]` already showed it. After this, every pointer does.
