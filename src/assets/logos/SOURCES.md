# Service logos

Brand marks of the services WireCat reads, shown by `ServiceIcon` (`src/shared/ServiceIcon.tsx`). Each is the
official file, unchanged, except where noted. The full record of where each came from and the brand rules read is
`design/logos/SOURCES.md` in [cli-docs](https://github.com/WireCatLabs/cli-docs); copy new files from there.

| File | Source | Note |
|---|---|---|
| max.png | https://max.ru/favicon.svg | rendered to 96 px: the 72 KB SVG drew the same at icon size; no brand page found |
| whatsapp.svg | https://www.whatsapp.com/ (its favicon) | Meta: no recolouring, so the green glyph in both themes |
| google-drive.svg, google-calendar.svg | https://fonts.gstatic.com/s/i/productlogos/ (2020q4 set) | Google: no recolouring or cropping |
| zoom.png | App Store icon of Zoom Workplace | resized to 96 px, corners rounded as the app shows it |
| bitrix24.svg | https://www.bitrix24.de/favicon.svg (the icon of https://www.bitrix24.com/), retrieved 2026-11-10 | checked: no script, link or image |

Telegram has no file here: its API terms (https://core.telegram.org/api/terms, 2.4) do not let another app use its
official logo. `ToolIcon` draws Lucide's `send` icon (https://lucide.dev/icons/send, ISC licence, already a dependency
as `lucide-react`) in white on a blue disc instead.
