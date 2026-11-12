# A new component

## First, look for one

Check [src/ui/](../../../src/ui/) and [reuse.md](reuse.md) before you write a component. `ui/` has Button (with
`busy` for an action under way), TextButton, LinkButton, BackButton, SplitButton, DecisionButtons, CopyButton (the only
copy to the clipboard), CopyField, CopyRef, Dialog, Disclosure, Collapse, AutoHeight, Crossfade, Callout, ErrorNotice
(also `tone="warn"` for a warning banner; the tool's own text under Details with `raw`), EmptyState (nothing to show,
and why), NoticeChips, Checkbox, Switch, Select, Combobox, NumberField, SecretField, FieldError (a field's error, with
`useFieldError`), Segmented (its `md` size is a page's Table · Board switch), Tabs, FilterBar, FilterMenu, Calendar,
Stepper, Skeleton, Lamp, Pill, Board, ProgressBar, DataTable (a page's table of records: Tasks, Search) and Pager,
RefreshButton (a page's Read again / Check again), Tooltip, InfoTip, ExpandChevron, SectionTitle and Logo. A page's
frame and title row are `Page` and `PageHeader` in [shared/Page.tsx](../../../src/shared/Page.tsx); an external link
is `ExtLink` and a page that needs a tool is `ToolNeeded` (both in `shared/`). Which component does which job, and
what still does it by hand: [ui-consistency.md](../ui-consistency.md).

Missing today: Toast and Popover. Do not write a hand-made one: add the primitive to `ui/` and use it in your place
first.

## ui/ or feature?

- **ui/** when it knows no data: props in, events out, no store, no platform, no feature. It may read `i18n` for
  its own words ([ui/messages.ts](../../../src/ui/messages.ts)). Biome fails the build if it imports more.
- **feature** when it reads a store, calls the platform or knows a tool. Keep it in `features/<area>/`.
- **shared/** when it knows data and two features use it (ToolIcon, ReportThis, ToolNeeded).

## Rules

- **Variants by prop, not by copy.** Follow [Button.tsx](../../../src/ui/Button.tsx): a `variant` and a `size`
  map to classes in one place. Do not pass long class strings from callers to restyle a primitive.
- **Tokens only.** Colours are tokens from [index.css](../../../src/styles/index.css) (`bg-app`, `text-ink`,
  `border-line`, `text-bad`). No hex values in components. Then dark mode works without extra code. Corners are
  `rounded-rack|pill|control|button|inset|dialog` and a raised panel's shadow is `shadow-panel` (names in
  [DESIGN.md](../../../DESIGN.md)); Tailwind's stock `shadow-sm…2xl` fail a one-way rule.
- **Dialogs.** The element that takes the first focus has `data-autofocus`; `Dialog` focuses it after it opens. On a
  confirm that deletes, that is the safe button.
- **Both themes.** Capture light and dark: `node scripts/capture.mjs out.png "?state=fresh" --dark`.
- **Keyboard.** Every action reachable by Tab, Enter and Space. Arrow keys inside lists and tab lists. Visible focus.
  A real `<button>` for an action, never a `div` with `onClick`.
- **Reduced motion.** Durations come from `MOTION` (and `--motion-*` in CSS), never a number of your own. Use
  `reducedMotion`, `revealIfHidden`, `focusInPlace` and `usePaced` from [ui/motion.ts](../../../src/ui/motion.ts). Never `scrollIntoView` or bare `focus()`: both can move the page.
- **Rule 9.** A click never moves what the user did not touch. Open and close are animated. Check with
  `node scripts/scroll-hold.mjs` when the component opens a panel.
- **Size.** Under 300 lines. Over that, split parts out and move rules to `domain/`.
- **No text literals.** Words come from a messages file ([i18n.md](i18n.md)).

## Checklist

1. Searched `ui/` and `shared/` (or the features listed in [reuse.md](reuse.md)).
2. Props typed. Variants as a union type.
3. A test by role for its behaviour, like [Dialog.test.tsx](../../../src/ui/Dialog.test.tsx).
4. Light and dark captures looked at.
5. Keyboard only run through it once.
