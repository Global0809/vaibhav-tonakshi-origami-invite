# Vaibhav & Tonakshi — Wedding Invitation

A separate client edition of the approved original animated invitation, followed by the interactive 3D baraat. 25–26 November 2026 · Nirvana River Resort, Rishikesh.

Public invitation: https://global0809.github.io/vaibhav-tonakshi-origami-invite/

## Preview locally

Run `npx --yes http-server . -p 4192 -c-1 -a 127.0.0.1` from this folder, then open http://127.0.0.1:4192/.

## Event details (India Standard Time)

| Date | Celebration | Time |
| --- | --- | --- |
| Wednesday, 25 November 2026 | Check-in | 12:00 PM |
| Wednesday, 25 November 2026 | Haldi | 1:00 PM |
| Wednesday, 25 November 2026 | Sangeet / Engagement | 7:00 PM |
| Thursday, 26 November 2026 | Baraat | 1:00 PM |
| Thursday, 26 November 2026 | Varmaala | 3:30 PM |
| Thursday, 26 November 2026 | Wedding Dinner | 7:00 PM |
| Friday, 27 November 2026 | Check-out | 12:00 PM |

## Editing

- `config.js`: names, event cards, countdown, venue and RSVP deadline.
- `index.html`: written invitation, full story, dress codes, travel and RSVP markup.
- `client-details.css`: client-specific responsive additions; `styles.css` retains the approved base design.
- `rsvp.js`: FormSubmit email integration. The inbox owner must activate the service and verify real delivery before guest launch; automated tests use mocked responses only. The direct-email RSVP link is also available.
- `world/`: built 3D experience. Its editable source remains in the separate local working project. The soundtrack uses `assets/audio/bgm.m4a` from the invitation root.
- `assets/origami-hero/`: the supplied portrait animation, converted to a scroll-driven WebP sequence with bounded mobile buffering and optional desktop detail frames.
- `assets/film/`: the two supplied replacement films, optimized for inline playback with lazy-loaded posters.

## Isolation and publication

This version has its own dedicated repository: `Global0809/vaibhav-tonakshi-origami-invite`. GitHub Pages serves the root of `codex/publish`. It does not replace any previously published invitation or repository.

Only guest-facing files are published. Local development notes, test artifacts, source backups and obsolete media are excluded. The supplied films and hero were optimized for the web; their original source files remain unchanged.
