# A new component

## First, look for one

Check [src/ui/](../../../src/ui/) and [reuse.md](reuse.md) before you write a component. `ui/` has Button,
TextButton, SplitButton, CopyButton, CopyField, Dialog, Disclosure, Collapse, AutoHeight, Crossfade, Callout,
ErrorNotice, Checkbox, Select, Combobox, Segmented, FilterBar, FilterMenu, Calendar, Stepper, Skeleton, Lamp, Pill.

Missing today and planned: Tabs, Switch, Field, Progress, Table, Toast, Tooltip, Popover. Their behaviour library is
being chosen in [ui-libraries.md](../ui-libraries.md). Until then, do not write a fifth hand-made progress bar or a
third tab list: add the primitive to `ui/` and use it in your place first.

## ui/ or feature?

- **ui/** when it knows no data: props in, events out, no store, no platform, no feature. It may read `i18n` for
  its own words ([ui/messages.ts](../../../src/ui/messages.ts)). Biome fails the build if it imports more.
- **feature** when it reads a store, calls the platform or knows a tool. Keep it in `features/<area>/`.
- **Target: shared/** when it knows data and two features use it (ToolIcon, ReportThis).

## Rules

- **Variants by prop, not by copy.** Follow [Button.tsx](../../../src/ui/Button.tsx): a `variant` and a `size`
  map to classes in one place. Do not pass long class strings from callers to restyle a primitive.
- **Tokens only.** Colours are tokens from [index.css](../../../src/styles/index.css) (`bg-app`, `text-ink`,
  `border-line`, `text-bad`). No hex values in components. Then dark mode works without extra code.
- **Both themes.** Capture light and dark: `node scripts/capture.mjs out.png "?state=fresh" --dark`.
- **Keyboard.** Every action reachable by Tab, Enter and Space. Arrow keys inside lists and tab lists. Visible focus.
  A real `<button>` for an action, never a `div` with `onClick`.
- **Reduced motion.** Use `PANEL_MS`, `reducedMotion`, `revealIfHidden` and `focusInPlace` from
  [ui/motion.ts](../../../src/ui/motion.ts). Never `scrollIntoView` or bare `focus()`: both can move the page.
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
