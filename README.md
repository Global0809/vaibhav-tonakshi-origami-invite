# Vaibhav & Tonakshi — Wedding Invitation

A personal, white-and-pink wedding invitation with real prewedding photographs, 25–26 November 2026 at Nirvana River Resort, Rishikesh.

Public invitation: [View the invitation](https://global0809.github.io/vaibhav-tonakshi-origami-invite/)

## Preview locally

Run `npx --yes http-server . -p 4192 -c-1 -a 127.0.0.1` from this folder and open http://127.0.0.1:4192/.

## Celebrations

| Date | Celebration | Time |
| --- | --- | --- |
| Wednesday, 25 November 2026 | Check-in | 12:00 PM |
| Wednesday, 25 November 2026 | Haldi | 1:00 PM |
| Wednesday, 25 November 2026 | Sangeet / Engagement | 7:00 PM |
| Thursday, 26 November 2026 | Baraat | 1:00 PM |
| Thursday, 26 November 2026 | Wedding Dinner | 7:00 PM |
| Friday, 27 November 2026 | Check-out | 12:00 PM |

Your stay will be lovingly hosted by us!

## Editing

- `index.html`: invitation, photo album, story, venue, travel and RSVP.
- `styles.css` and `photo-details.css`: the original glass invitation format, white-and-pink palette, responsive photographs and reduced-motion treatment.
- `config.js`: four celebrations, inline attire hints and countdown.
- `app.js`: mandala seal and opening doors, scroll-linked photo dissolves, light pink petals, animated flourishes, event cards, countdown and background music.
- `rsvp.js`: FormSubmit integration with an email fallback. The inbox owner must activate the service and verify actual email delivery. Automated tests use mocked submissions only.
- `assets/photos/`: responsive WebP photographs. Original high-resolution files remain private and unchanged.
- Typography retains the original Comic Neue invitation lettering, with Comic Sans and related platform fallbacks.

The custom monogram and #Vclearedtheinterview signature accompany the couple’s photographs. Resort photography comes from [Nirvana’s official website](https://www.nirvanarishikesh.com/).

## Performance and publication

No videos, AI frame sequences or 3D world ship in this photo edition. The original animated format is preserved: two real portraits dissolve as the guest scrolls the sticky hero, and the rest of the photographs use the existing cinematic frames. Only the opening portrait gates entry; other images load lazily. Scroll updates change opacity and transforms without video decoding. Ambient petals are capped and stop when the page is hidden. Reduced-motion preferences are respected. Music starts from a guest gesture and can be paused using the bell.

This edition has one dedicated repository: `Global0809/vaibhav-tonakshi-origami-invite`. GitHub Pages serves the root of `codex/publish`. Earlier client websites are separate and unchanged by this project. Private notes, tests, original photographs and archived runtime media are excluded from publication.
