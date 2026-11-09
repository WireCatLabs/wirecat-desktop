# Memory that explains itself (UX-125)

Owner, 2026-11-09, after opening Memory on real data: "в памяти ничего не понятно… кружки желтые… какие источники
(давать их глянуть)"; "не вижу возможности редактировать память, а это база"; "в URL я бы сразу подтягивал и делал
preview"; "Файл — то же самое — отображать превью"; "не работает предложить факты"; "непонятно, что даёт только
сохранить".

## What the owner must understand to decide on a row

1. What agents will know if he approves: the record as one sentence.
2. What each button changes: approve, agents use it as true; reject, it moves to Rejected and is not used.
3. Where it came from: the source document or message, opened in place.
4. That he can correct it: wording, kind and who it is about for a memory or fact; the role for a relationship.

## Built (branch `feat/memory-explained`)

- **Explained page.** A three-step strip (agent suggests → you review → agents use), one line under each tab, a
  status word ("Ждёт решения", "Используется", "Отклонено") in place of the coloured lamp.
- **Rows as sentences.** A relationship reads "Yaro Orlov — владелец документа «Sales motivation model»". Memo's
  `null #<id>` name placeholders are dropped (`cleanName`, the same change as the People branch `feat/people-kinds`).
- **Opened row.** "What agents will know" with the effect of each button, an always visible Edit, and the source.
  A Drive or Bitrix24 link shows its document as the source.
- **Edit.** A memory or fact: text, kind, subject (`memo add --supersedes`). A relationship: the role, chosen from
  memo's list or typed; a proposal is approved first (`review confirm`), then the link it made is changed
  (`relationships update`); a link can be removed (`relationships remove`). No memo release is needed.
- **Groups.** A group header with a count, collapse, and Approve all / Reject all when two or more rows wait; one
  `review confirm|reject` call decides the whole group and names each refusal.
- **Add panel.** A link is previewed 600 ms after the address settles; a picked file shows as a thumbnail (pictures
  up to 4 MiB, as a `data:` address the window's policy allows) or its first 600 characters (text). A picture says
  it is kept by its name. When no reader is chosen, the choice appears in the panel, not only in Settings (BUG-670).
  "Only save it" is now a standard "Save without facts" button with a line that says what it does.

## Not built, and why

- **Link preview needs memo.** Desktop calls `memo sources preview <url>` and shows nothing when memo has no such
  command (all released memo versions today). The app does not fetch pages itself: memo already refuses private
  addresses, sign-in pages and long redirects (IDEA-268).
- **Reading pictures (IDEA-267).** The image reader answers `needs-agent`; reading a picture needs the AI-model
  setting (CORE-53). Until then a picture is kept by its name, as ruled earlier (NEED-3).
- **A source's facts apart from the owner's (UX-125.c)** and **folding a bulk arrival into one card (UX-125.d):**
  groups by subject with Approve all cover the review load for now.

## Risks

- **Approve all on a Drive group.** A document group can hold many owner and editor links. Approving them all makes
  agents treat every Drive owner as a fact the owner confirmed. The owner decides whether such links should show for
  review at all.
