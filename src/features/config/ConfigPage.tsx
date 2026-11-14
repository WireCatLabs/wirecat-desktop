import { Search } from "lucide-react"
import { type ReactNode, useEffect, useMemo, useState } from "react"
import { findTool, tools } from "@/domain/catalog"
import { AppPreferences, settingsMessages } from "@/features/settings"
import { formatList, useLang, useMessages } from "@/i18n"
import { nameOf, useAccountNames } from "@/shared/account-names-store"
import { openSection } from "@/shared/go-tool"
import { Page, PageHeader } from "@/shared/Page"
import { ReportThis } from "@/shared/ReportThis"
import { ToolIcon } from "@/shared/ToolIcon"
import { useTools } from "@/shared/tools-store"
import { Button } from "@/ui/Button"
import { Collapse } from "@/ui/Collapse"
import { Dialog } from "@/ui/Dialog"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { fieldFocus } from "@/ui/field"
import { InfoTip } from "@/ui/InfoTip"
import { Monogram } from "@/ui/Logo"
import { SectionTitle } from "@/ui/SectionTitle"
import { Segmented } from "@/ui/Segmented"
import { Skeleton } from "@/ui/Skeleton"
import { LineTab, TabList, TabPanel, Tabs } from "@/ui/Tabs"
import { CategoriesEditor, CategoriesPlaceholder } from "./CategoriesEditor"
import { JsonActions, JsonTab } from "./JsonTab"
import { configMessages } from "./messages"
import { reasonText, reportText } from "./reason"
import { SettingsList, SettingsPlaceholder } from "./SettingsList"
import { isCategory, sharedCandidates } from "./scope"
import {
  isDefaultsView,
  isDirty,
  readLast,
  remember,
  type Shape,
  sourceOf,
  type Tab,
  type Target,
  useConfig,
} from "./store"

const configurable = tools.filter((t) => t.settings !== null)
const DEFAULTS = "\u0000defaults"
const SHARED = "\u0000shared"
// First visit, before any list was seen: the messengers report 16 settings, the shared view 5 categories and 4 more.
const TOOL_SHAPE: Shape = { rows: 16, categories: 0, file: true }
const SHARED_SHAPE: Shape = { rows: 4, categories: 5, file: false }

type Switch = { kind: "tool"; id: string } | { kind: "shared" } | { kind: "target"; target: Target }

export function ConfigPage() {
  const sm = useMessages(settingsMessages)
  const m = useMessages(configMessages)
  const st = useConfig()
  const installs = useTools((s) => s.installs)
  const [pending, setPending] = useState<Switch | null>(null)
  const dirty = isDirty(st)
  const latest = useTools((s) => s.latest)
  const shared = st.view === "shared"
  const tool = shared ? null : (configurable.find((t) => t.id === st.tool) ?? null)
  const src = sourceOf(st.tool)
  const candidates = sharedCandidates(installs, latest)

  const detected = Object.keys(installs).length > 0
  const noneInstalled = detected && configurable.every((t) => (installs[t.id]?.length ?? 0) === 0)
  useEffect(() => {
    if (!detected) return
    const { installs: all, latest: newest } = useTools.getState()
    const installed = Object.entries(all)
      .filter(([, copies]) => copies.length > 0)
      .map(([id]) => id)
    useConfig.getState().start(installed, sharedCandidates(all, newest))
  }, [detected])

  const go = (s: Switch) =>
    s.kind === "tool"
      ? st.chooseTool(s.id)
      : s.kind === "shared"
        ? st.chooseShared(candidates)
        : st.chooseTarget(s.target)
  const request = (s: Switch) => {
    if (dirty) setPending(s)
    else go(s)
  }

  return (
    <Page>
      <PageHeader title={sm.title} intro={sm.intro} />

      <AppPreferences />

      <div className="flex flex-col gap-4 border-t border-line pt-[1.5rem]">
        <div>
          <SectionTitle>{sm.tools}</SectionTitle>
          <p className="mt-1 max-w-[70ch] text-[0.95rem] text-ink-soft">
            {sm.toolsIntro(<code className="font-mono">config set</code>)}
          </p>
        </div>
        <ToolPicker
          label={sm.tool}
          candidates={candidates.length > 0}
          onShared={() => request({ kind: "shared" })}
          onTool={(id) => request({ kind: "tool", id })}
        />
        <Collapse open={noneInstalled}>
          <p className="flex flex-wrap items-center gap-3 text-[0.95rem] text-ink-soft">
            {m.noneInstalled}
            <Button variant="secondary" size="sm" onClick={() => openSection("tools")}>
              {m.openTools}
            </Button>
          </p>
        </Collapse>

        {tool && src?.perProfile && (
          <ProfilePicker
            toolName={tool.name}
            defaults={src.defaults}
            onSelect={(target) => request({ kind: "target", target })}
          />
        )}
        <ScopeLine />
      </div>

      {st.settings?.notice && <ErrorNotice tone="warn">{m.fromProfile(st.settings.notice.profile)}</ErrorNotice>}
      {st.error && (
        <ErrorNotice action={<ReportThis what="Reading settings" tool={st.tool} error={reportText(st.error)} />}>
          {reasonText(m, st.error)}
        </ErrorNotice>
      )}

      {(tool || shared) && (st.target || st.profiles === undefined) && !st.error && (
        <Panel toolName={tool?.name ?? ""} dirty={dirty} />
      )}

      {/* Account groups (GroupsSetting from @/features/groups) are hidden until an agent can be connected to a group. */}

      <Dialog
        open={pending !== null}
        title={m.discard.title}
        onClose={() => setPending(null)}
        actions={
          <>
            <Button variant="secondary" onClick={() => setPending(null)} data-autofocus>
              {m.discard.keep}
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                const s = pending
                setPending(null)
                if (s) go(s)
              }}
            >
              {m.discard.confirm}
            </Button>
          </>
        }
      >
        {m.discard.body}
      </Dialog>
    </Page>
  )
}

function ProfilePicker(props: { toolName: string; defaults: boolean; onSelect: (t: Target) => void }) {
  const { toolName, defaults, onSelect } = props
  const m = useMessages(configMessages)
  const profiles = useConfig((s) => s.profiles)
  const error = useConfig((s) => s.profilesError)
  const toolId = useConfig((s) => s.tool)
  const names = useAccountNames((n) => n.names)
  const target = useConfig((s) => s.target)
  const current = target === null ? null : (target.profile ?? DEFAULTS)

  if (profiles === undefined) {
    return (
      <Picker label={m.profile}>
        <Skeleton className="h-8 w-[14rem] rounded-inset" label={m.readingProfiles} />
      </Picker>
    )
  }
  if (profiles !== null && profiles.length === 0 && !defaults) {
    return (
      <p className="text-[0.95rem] text-ink-soft">
        {error ? `${error}. ${m.profilesFailed(toolName)}` : m.noProfiles(toolName)}
        {error && <ReportThis what={`Listing ${toolName} profiles`} tool={toolId} error={error} />}
      </p>
    )
  }
  return (
    <div className="flex flex-col gap-2">
      <Picker label={m.profile}>
        <Segmented
          size="md"
          label={m.profile}
          value={current ?? ""}
          onChange={(v) => onSelect({ profile: v === DEFAULTS ? null : v })}
          options={[
            ...(defaults ? [{ value: DEFAULTS, label: m.defaults }] : []),
            ...(profiles ?? []).map((p) => {
              const name = toolId ? nameOf(names, toolId, p.name) : null
              return name ? { value: p.name, label: name, count: p.name } : { value: p.name, label: p.name }
            }),
          ]}
        />
      </Picker>
      {profiles?.length === 0 && <p className="text-[0.9rem] text-ink-dim">{error ?? m.noProfilesHint(toolName)}</p>}
      {current === null && <p className="text-[0.9rem] text-ink-dim">{m.chooseProfile}</p>}
    </div>
  )
}

function Picker({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Seen only: the switch's own legend names it for a screen reader. */}
      <span aria-hidden className="mr-2 min-w-[4.2rem] text-[0.9rem] font-medium text-ink-dim">
        {label}
      </span>
      {children}
    </div>
  )
}

/** The tools that are not installed are left out of the switch; the "i" beside it names them and why. */
function ToolPicker(props: { label: string; candidates: boolean; onShared: () => void; onTool: (id: string) => void }) {
  const { label, candidates, onShared, onTool } = props
  const m = useMessages(configMessages)
  const lang = useLang()
  const st = useConfig()
  const installs = useTools((s) => s.installs)
  const missing = configurable.filter((t) => installs[t.id]?.length === 0)
  const options = [
    ...(candidates ? [{ value: SHARED, label: m.shared, icon: <Monogram className="size-4" /> }] : []),
    ...configurable
      .filter((t) => !missing.includes(t))
      .map((t) => ({ value: t.id, label: t.name, icon: <ToolIcon id={t.id} className="size-4" /> })),
  ]
  return (
    <Picker label={label}>
      {options.length > 0 && (
        <Segmented
          size="md"
          label={label}
          value={st.view === "shared" ? SHARED : (st.tool ?? "")}
          onChange={(v) => (v === SHARED ? onShared() : onTool(v))}
          options={options}
        />
      )}
      {(missing.length > 0 || !candidates) && (
        <InfoTip label={m.notShown}>
          {missing.length > 0 && (
            <p>
              {m.notInstalledList(
                formatList(
                  missing.map((t) => t.name),
                  lang,
                ),
              )}
            </p>
          )}
          {!candidates && <p>{m.sharedNeedsTool}</p>}
        </InfoTip>
      )}
    </Picker>
  )
}

/** One line under the pickers saying what the panel below changes. */
function ScopeLine() {
  const m = useMessages(configMessages)
  const view = useConfig((s) => s.view)
  const id = useConfig((s) => s.tool)
  const target = useConfig((s) => s.target)
  const installs = useTools((s) => s.installs)
  const profiles = useConfig((s) => s.profiles)
  const tool = id ? findTool(id) : undefined
  const src = sourceOf(id)
  let text: ReactNode = null
  if (view === "shared" && !tool) {
    text = (
      <>
        {m.sharedScope} <Skeleton chars={22} />
      </>
    )
  } else if (view === "shared") {
    const version = id ? installs[id]?.[0]?.version : null
    text = (
      <>
        {m.sharedScope}
        {tool && (
          <>
            {" "}
            {m.readThrough(
              <span className="font-mono">
                {tool.bin}
                {version ? ` ${version}` : ""}
              </span>,
            )}
          </>
        )}
      </>
    )
  } else if (tool && src && !src.perProfile) {
    text = m.oneFile(tool.name)
  } else if (tool && target?.profile) {
    text = m.onlyProfile(tool.name, <span className="font-mono">{target.profile}</span>)
  } else if (tool && target) {
    text = m.defaultsScope(tool.name)
  } else if (tool && profiles === undefined) {
    text = <Skeleton chars={96} />
  }
  return text && <p className="max-w-[80ch] text-[0.95rem] text-ink-soft">{text}</p>
}

function Panel({ toolName, dirty }: { toolName: string; dirty: boolean }) {
  const m = useMessages(configMessages)
  const st = useConfig()
  const src = sourceOf(st.tool)
  const shared = st.view === "shared"
  const all = st.settings?.rows ?? []
  const categories = shared ? all.filter(isCategory) : []
  const others = useMemo(
    () => (st.settings?.rows ?? []).filter((r) => !isCategory(r) && r.key !== "task_categories"),
    [st.settings],
  )
  const rows = useMemo(() => {
    const q = st.query.trim().toLowerCase()
    return q ? others.filter((r) => r.key.toLowerCase().includes(q)) : others
  }, [others, st.query])

  const shapeKey = shared ? "shared" : (st.tool ?? "")
  const loaded = st.settings
  const waiting = loaded === null
  // biome-ignore lint/correctness/useExhaustiveDependencies: read again only when a new placeholder is about to show
  const shape = useMemo(
    () => readLast().shapes?.[shapeKey] ?? (shared ? SHARED_SHAPE : TOOL_SHAPE),
    [shapeKey, shared, waiting],
  )
  useEffect(() => {
    if (!loaded) return
    const next = { rows: others.length, categories: categories.length, file: Boolean(loaded.configFile) }
    remember((l) => ({ ...l, shapes: { ...l.shapes, [shapeKey]: next } }))
  }, [loaded, others, categories.length, shapeKey])

  const label = shared
    ? m.panel.shared
    : isDefaultsView(src, st.target)
      ? m.panel.defaults(toolName)
      : st.target?.profile
        ? m.panel.profile(toolName, st.target.profile)
        : m.panel.all(toolName)

  const tabs: { id: Tab; label: string }[] = [
    { id: "settings", label: m.tabSettings },
    { id: "json", label: m.tabJson },
  ]

  return (
    <section aria-label={label} className="overflow-hidden rounded-rack border border-line-strong bg-app">
      <Tabs selectedKey={st.tab} onSelectionChange={(k) => st.setTab(k as Tab)}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-line border-b px-[1.3rem]">
          <TabList aria-label={m.tabs} className="flex gap-5">
            {tabs.map((t) => (
              <LineTab
                key={t.id}
                id={t.id}
                extra={
                  t.id === "json" &&
                  dirty && (
                    <span className="ml-1.5 text-brand">
                      ●<span className="sr-only"> {m.unsaved}</span>
                    </span>
                  )
                }
              >
                {t.label}
              </LineTab>
            ))}
          </TabList>
          {st.tab === "settings" ? (
            <label className="relative flex items-center py-2">
              <span className="sr-only">{m.search}</span>
              <Search className="pointer-events-none absolute left-2.5 size-3.5 text-ink-dim" aria-hidden />
              <input
                type="search"
                value={st.query}
                onChange={(e) => st.setQuery(e.target.value)}
                placeholder={m.search}
                className={`h-8 w-[15rem] rounded-control border border-line-strong bg-app pr-2.5 pl-8 text-[0.95rem] text-ink placeholder:text-ink-dim ${fieldFocus}`}
              />
            </label>
          ) : (
            <JsonActions dirty={dirty} />
          )}
        </div>

        <TabPanel id={st.tab}>
          {st.settings === null && st.tab === "settings" ? (
            shared ? (
              <>
                <CategoriesPlaceholder count={shape.categories} />
                {shape.rows > 0 && <OthersHeading />}
                <SettingsPlaceholder count={shape.rows} />
              </>
            ) : (
              <SettingsPlaceholder count={shape.rows} label={m.reading} />
            )
          ) : st.tab === "settings" ? (
            <>
              {dirty && (
                <p className="border-line border-b bg-warn/10 px-[1.3rem] py-2.5 text-[0.95rem]">{m.jsonDirty}</p>
              )}
              {shared && (
                <CategoriesEditor
                  rows={categories}
                  unreadable={all.find((r) => r.key === "task_categories")?.from ?? null}
                  query={st.query}
                  disabled={dirty}
                />
              )}
              {shared && rows.length > 0 && <OthersHeading />}
              {(!shared || rows.length > 0) && <SettingsList rows={rows} disabled={dirty} />}
            </>
          ) : (
            <JsonTab />
          )}
        </TabPanel>
        {(st.settings ? st.settings.configFile : shape.file) && (
          <p className="border-line border-t px-[1.3rem] py-2.5 text-[0.9rem] text-ink-dim">
            {m.file(<span className="selectable font-mono">{st.settings?.configFile ?? <Skeleton chars={28} />}</span>)}
          </p>
        )}
      </Tabs>
    </section>
  )
}

function OthersHeading() {
  const m = useMessages(configMessages)
  return (
    <h3 className="border-line border-b px-[1.3rem] pt-4 pb-2.5 text-[1.08rem] font-semibold leading-tight">
      {m.otherShared}
    </h3>
  )
}
