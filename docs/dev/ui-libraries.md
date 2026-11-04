# UI libraries for WireCat Desktop: what exists and what to pick

Date of research: 2026-11-04. Facts come from npm registry, GitHub API, official docs and my own esbuild runs. Anything I could not check is marked **UNVERIFIED**.

## 1. The four categories (the main confusion)

Think of a button that opens a menu. Four different jobs hide in it.

1. **Styling engine.** Makes things look right (colors, spacing). Example: [Tailwind CSS](https://tailwindcss.com). You already have it. It has no behavior. It gives you no menu logic, no focus trap, no keyboard handling.
2. **Headless behavior library.** Gives behavior and accessibility, no looks. Keyboard, focus, ARIA, positioning. You style it with Tailwind. Examples: [React Aria Components](https://react-aria.adobe.com), [Radix Primitives](https://www.radix-ui.com/primitives), [Base UI](https://base-ui.com), [Ark UI](https://ark-ui.com) (built on Zag), [Headless UI](https://headlessui.com).
3. **Copy-in styled collections.** A pre-styled component file (Tailwind classes on top of a headless library) that a CLI copies into your repo. You own the code. Examples: [shadcn/ui](https://ui.shadcn.com) (on Radix, Base UI or React Aria), [Jolly UI](https://github.com/jolbol1/jolly-ui) (React Aria, 1116 stars, last push 2026-11-01 per the GitHub API).
4. **Full styled kits.** Ship their own look, theme system and often their own styling engine. Examples: Mantine, HeroUI, Chakra, MUI. Hard to keep a custom look.

shadcn/ui is not a library you install. It is category 3: Tailwind classes plus a headless library, copied in. So "shadcn or Radix" is a wrong pair. shadcn needs a layer 2 library underneath.

**What we need:** category 2 only. We already have Tailwind (1) and our own look (the 42 components). We lack behavior for Tabs, Switch, Tooltip, Popover, Menu, Toast, Table, Progress. Category 3 would bring a second look to remove. Category 4 would fight our design.

## 2. Maintenance (checked 2026-11-04)

| Library | Latest on npm | Released | Repo, last push | Commits in last 90 days | Who |
|---|---|---|---|---|---|
| Radix (`radix-ui` 1.8.1) | [npm](https://www.npmjs.com/package/radix-ui) | 2026-10-12 | [primitives](https://github.com/radix-ui/primitives) 2026-10-14 | 69 | WorkOS, mostly one person |
| Base UI (`@base-ui/react` 1.9.0) | [npm](https://www.npmjs.com/package/@base-ui/react) | 2026-10-09 | [mui/base-ui](https://github.com/mui/base-ui) 2026-11-04 | 449 | MUI team |
| React Aria Components 1.22.1 | [npm](https://www.npmjs.com/package/react-aria-components) | 2026-10-09 | [adobe/react-spectrum](https://github.com/adobe/react-spectrum) 2026-11-04 | 197 | Adobe |
| Ark UI 5.40.0 | [npm](https://www.npmjs.com/package/@ark-ui/react) | 2026-10-29 | [chakra-ui/ark](https://github.com/chakra-ui/ark) 2026-11-03 | 139 | Chakra team |
| Headless UI 2.2.10 | [npm](https://www.npmjs.com/package/@headlessui/react) | 2026-04-07 | [tailwindlabs/headlessui](https://github.com/tailwindlabs/headlessui) 2026-04-13 | not counted (no recent pushes) | Tailwind Labs |
| shadcn CLI 4.23.0 | [npm](https://www.npmjs.com/package/shadcn) | 2026-10-27 | [shadcn-ui/ui](https://github.com/shadcn-ui/ui) 2026-11-04 | 271 | shadcn |

Source of counts: GitHub REST API `commits?since=` (my own query, 2026-11-04).

**Radix after WorkOS.** The Radix site footer still reads "Made by WorkOS" ([releases page](https://www.radix-ui.com/primitives/docs/overview/releases)). The repo is alive but slow. In 2026, 76 of the last 100 commits are by one author ([GitHub commits API](https://api.github.com/repos/radix-ui/primitives/commits?per_page=100&since=2026-01-01T00:00:00Z)). There are 134 open issues ([GitHub search](https://api.github.com/search/issues?q=repo:radix-ui/primitives+type:issue+state:open)). Releases still ship (1.8.1 on 2026-10-12). Verdict: not dead, thin bus factor, a third of Base UI's pace in commits (69 vs 449). I found no official WorkOS statement about the future. **UNVERIFIED:** WorkOS plans.

**Base UI 1.x.** Stable since v1.0.0 on 2025-12-11, "35 unstyled UI components" ([release notes](https://base-ui.com/react/overview/releases)). Monthly minors since (1.7 Aug, 1.8 Sep, 1.9 Oct 2026). The package moved from `@base-ui-components/react` to `@base-ui/react`. Created by ex-Radix and MUI people. **UNVERIFIED:** exact founders list.

**shadcn/ui.** Base UI became the default in July 2026. Quote: "Base UI is the default component library in shadcn/ui", and "Radix is not being deprecated... every update and new component will ship for both" ([changelog](https://ui.shadcn.com/docs/changelog/2026-07-base-ui-default)). React Aria is a third supported base, "a first-class component base", chosen with `aria` at init ([changelog](https://ui.shadcn.com/docs/changelog/2026-07-react-aria)). The page does not say which React Aria components exist. **UNVERIFIED:** how complete shadcn's React Aria set is.

## 3. Coverage

Checked by exports in the installed npm packages (my run) and docs lists.

| Need | Radix | Base UI 1.9 | React Aria Components | Ark UI | Headless UI |
|---|---|---|---|---|---|
| Dialog | yes | yes | yes | yes | yes |
| Popover | yes | yes | yes | yes | yes |
| Menu | yes | yes | yes | yes | yes |
| Tabs | yes | yes | yes | yes | yes |
| Switch | yes | yes | yes | yes | yes |
| Combobox | **no** | yes | yes | yes | yes |
| Select | yes | yes | yes | yes | yes |
| Tooltip | yes | yes | yes | yes | yes |
| Toast | yes | yes | yes, marked `UNSTABLE_` | yes | **no** |
| Calendar / Date picker | **no** | **no** (not in component list) | yes | yes | **no** |
| Table / grid | **no** | **no** | yes (Table, GridList, Tree) | **no** (tree view only) | **no** |
| Drag and drop | **no** | **no** | yes (`useDragAndDrop`) | **no** | **no** |
| Virtualized list | **no** | **no** | yes (`Virtualizer`) | **no** | **no** |
| Field / Input / Progress | Form, Progress | Field, Input, Progress, Meter | TextField, ProgressBar | Field, Progress | Field, Input |

Sources: [Base UI component list](https://base-ui.com/llms.txt), [React Aria home](https://react-aria.adobe.com/), [Radix package deps](https://registry.npmjs.org/radix-ui), [Ark components in npm package](https://www.npmjs.com/package/@ark-ui/react), [Headless UI package](https://www.npmjs.com/package/@headlessui/react).

Note: we already own Calendar and Combobox. We would replace behavior only if it improves a11y or i18n. Table, Toast and Tooltip are the real gaps.

## 4. i18n and RTL

- **React Aria:** "localized strings for 30+ languages", dates and numbers in "many calendar and numbering systems", RTL keyboard handling, and layouts mirrored ([quality page](https://react-aria.adobe.com/quality)). The home page states 13 calendar systems and 5 numbering systems ([home](https://react-aria.adobe.com/)). Apps set the locale with `I18nProvider`. This matches en/ru/es.
- **Base UI:** has a `DirectionProvider` for RTL ([component list](https://base-ui.com/llms.txt)). No date logic. Built-in strings are few. **UNVERIFIED:** localized built-in labels.
- **Radix:** a `Direction` provider (`@radix-ui/react-direction` in [deps](https://registry.npmjs.org/radix-ui)). No date or number logic.
- **Ark / Zag:** has date picker, locale via its own provider. **UNVERIFIED:** depth of locale data.

## 5. Size (my measurement, not bundlephobia)

Method: esbuild 0.2x, minify, ESM, React external, gzip -9, installed latest versions. Set: Dialog, Popover, Menu, Tabs, Combobox (Radix has no Combobox, so Select was used instead).

| Library | min+gzip |
|---|---|
| Radix (4 parts + Select) | 41.9 KB (4 parts without Select: 35.8 KB) |
| Ark UI (5 parts) | 61.2 KB |
| React Aria Components (5 parts) | 66.8 KB |
| Base UI (5 parts) | 89.3 KB |

One part: Dialog Radix 14.2 KB, Base UI 23.9 KB, RAC 23.0 KB, Ark 21.1 KB. Tabs: Base UI 13.6 KB, Ark 13.0 KB, RAC 31.7 KB.

Reading: Radix is smallest. Base UI is not lighter than React Aria for a bigger set. The numbers are for a Tauri app that loads from disk, so they matter little. Tree shaking: Base UI declares `"sideEffects": false` (checked in its package.json). React Aria Components lists side-effect files, so it shakes less well. Both support per-component imports. I did not test a real-app build.

## 6. React 19, Tailwind 4, styling approach

- **Radix:** peer React up to 19 ([npm](https://registry.npmjs.org/radix-ui)). Style via `data-state="open"` attributes. Wrapper `asChild` for composition.
- **Base UI:** peer React 17 to 19 ([npm](https://registry.npmjs.org/@base-ui/react)). Style via `data-*` attributes. `className` and `render` props can be functions of state. Its peer list also names `date-fns` and `@date-fns/tz`, which hints at date work in 1.9 (**UNVERIFIED**, optional peers not checked).
- **React Aria Components:** peer React up to 19 ([npm](https://registry.npmjs.org/react-aria-components)). Style via `data-pressed`, `data-focus-visible`, `data-selected` and via function `className`/render props. Tailwind plugin `tailwindcss-react-aria-components` exists. **UNVERIFIED:** its Tailwind 4 status. Plain `data-[selected]:` variants work without it.
- **HeroUI 3** (kit, for comparison) needs React 19, Tailwind 4 and is built on React Aria ([npm](https://registry.npmjs.org/@heroui/react)). It shows that React Aria and Tailwind 4 combine well.
- None of these needs CSS-in-JS. Kits: Chakra and MUI need Emotion ([Chakra](https://registry.npmjs.org/@chakra-ui/react), [MUI](https://registry.npmjs.org/@mui/material)). Mantine 9 needs React 19.2 ([npm](https://registry.npmjs.org/@mantine/core)) and its own CSS.

## 7. Accessibility reputation

- **React Aria:** strongest. Tested with VoiceOver (macOS, iOS), JAWS, NVDA, TalkBack on many devices ([quality page](https://react-aria.adobe.com/quality)). Adobe states some automated tools give false positives and documents them.
- **Radix:** long record, follows WAI-ARIA patterns, widely audited by use. Some known open issues around Select and focus. **UNVERIFIED:** current counts.
- **Base UI:** has an [accessibility page](https://base-ui.com/react/overview/accessibility). Younger. Fewer years of field reports.
- **Ark/Zag:** state machines, decent. Smaller user base. **UNVERIFIED:** screen reader test claims.
- **Headless UI:** fine, but slow updates (last release April 2026).
No independent head-to-head audit was found. This section is reputation, not measurement.

## 8. Migration cost for our case (keep the look, swap behavior)

All four headless libraries allow it one component at a time. Our `src/ui` components keep their props and Tailwind classes. Only the inside changes.

- **Radix / Base UI:** compound parts (`Root`, `Trigger`, `Content`). Close to our existing Dialog and Disclosure shapes. Easy mapping to `data-*` selectors. Both render real DOM and take `className`.
- **React Aria Components:** also compound, but several things differ. Collections use `<ListBoxItem>` and `id` keys. Selection is a `Set` of keys. Buttons use `onPress`, not `onClick`. Wrap the app in `I18nProvider`. Native `<dialog>` is replaced by its `Modal`. Our Calendar and Combobox could swap last or stay.
- **Order I would use:** (1) new components we lack (Tabs, Switch, Tooltip, Popover, Menu, Toast, Progress, Table), (2) Field and Input, (3) existing ones only when a bug or a11y gap shows.
- Risk for Rule 9 (nothing jumps): portals and focus management change scroll and focus behavior. Run `scripts/scroll-hold.mjs` after each swap. Both Base UI and React Aria support animation state attributes (`data-starting-style` and `data-entering`). **UNVERIFIED:** exit animation details for each.
- Mixing is possible but each library adds its own focus and overlay layer. Pick one.

## 9. Recommendation

**Use React Aria Components, headless, with our own Tailwind classes. Do not add shadcn or a kit.**

Reasons:
1. Only library with everything on our gap list in one package: Tabs, Switch, Tooltip, Popover, Menu, Table, plus Calendar, Combobox, Virtualizer and drag and drop for later (verified by export check).
2. We ship en/ru/es. React Aria brings localized strings, locale-aware dates and numbers, and RTL (30+ languages, [quality page](https://react-aria.adobe.com/quality)). Others leave this to us.
3. Best accessibility reputation, with real screen reader testing.
4. Healthy: Adobe, release 2026-10-09, 197 commits in 90 days, Apache-2.0.
5. Styling fits Tailwind 4 by `data-*` attributes and state functions. We keep our look.
6. Cost: bigger bundle than Radix (about 67 KB vs 42 KB gzip for our set, my estimate), the `UNSTABLE_` Toast, and a new mental model (`onPress`, keys, `Set` selection).

**Runner-up: Base UI.** It wins if we want API shape closest to Radix and our hand-made components, a stable Toast, and shadcn as default (so docs, examples and AI-written code target it). It loses on Table, Calendar, Date picker, drag and drop, and has no i18n helpers, so we would keep our own Calendar and write Table by hand. If Table and date work stay out of scope, switch to Base UI.

**Why not Radix:** no Combobox, Calendar, Table. Thin maintenance (one main author, 69 commits in 90 days). shadcn itself moved its default away from it.

**Why not shadcn:** it is a style layer. We would delete its look to keep ours. It could still serve as a reference for how to wrap each primitive with Tailwind.

## 10. Could not verify

- WorkOS roadmap for Radix (no official statement found).
- Base UI exit animation and date-fns peer purpose.
- Tailwind 4 status of the React Aria Tailwind plugin.
- shadcn React Aria component completeness.
- Bundlephobia numbers (I used my own esbuild builds instead).
- Real app bundle impact after tree shaking.
