import { RotateCcw } from "lucide-react"
import { type CSSProperties, useEffect, useId, useRef, useState } from "react"
import { ENDONYMS, LANGS, type LangChoice, systemLang, useLanguage, useMessages } from "@/i18n"
import { platform } from "@/platform/bridge"
import { Button } from "@/ui/Button"
import { Select } from "@/ui/Select"
import { settingsMessages } from "./messages"
import { DEFAULT_SCALE, MAX_SCALE, MIN_SCALE, SCALE_STEP, useScale } from "./scale"

/** WireCat's own preferences, above the tools' settings on the Settings page. */
export function AppPreferences() {
  const m = useMessages(settingsMessages)
  return (
    <section aria-labelledby="app-preferences" className="@container">
      <h2 id="app-preferences" className="sr-only">
        {m.app}
      </h2>
      <div className="grid gap-x-10 gap-y-6 @2xl:grid-cols-2">
        <LanguageSetting />
        <ScaleSetting />
      </div>
    </section>
  )
}

function ScaleSetting() {
  const m = useMessages(settingsMessages)
  const percent = useScale((s) => s.percent)
  const set = useScale((s) => s.set)
  const [shown, setShown] = useState(percent)
  const input = useRef<HTMLInputElement>(null)
  const id = useId()
  const mod = platform.os === "macos" ? "⌘" : "Ctrl"

  useEffect(() => setShown(percent), [percent])

  // Every size is in rem, so the slider itself grows while it is dragged; applied on release (the native `change`,
  // which React's onChange is not), the thumb stays under the pointer.
  useEffect(() => {
    const el = input.current
    if (!el) return
    const commit = () => set(Number(el.value))
    el.addEventListener("change", commit)
    return () => el.removeEventListener("change", commit)
  }, [set])

  return (
    // Stacked at every size: side by side, a bigger size would wrap the slider below and move it from under the pointer.
    <div className="flex flex-col gap-3">
      <div>
        <label htmlFor={id} className="font-medium">
          {m.size}
        </label>
        <p className="mt-1 max-w-[60ch] text-[0.9rem] text-ink-soft">{m.sizeHelp(mod)}</p>
      </div>
      <div className="flex items-center gap-3">
        <input
          ref={input}
          id={id}
          type="range"
          min={MIN_SCALE}
          max={MAX_SCALE}
          step={SCALE_STEP}
          value={shown}
          onChange={(e) => setShown(Number(e.target.value))}
          aria-valuetext={`${shown}%`}
          style={{ "--fill": `${((shown - MIN_SCALE) / (MAX_SCALE - MIN_SCALE)) * 100}%` } as CSSProperties}
          className="range w-[14rem]"
        />
        <output htmlFor={id} className="w-[3.2rem] text-right font-mono tabular-nums">
          {shown}%
        </output>
        <Button
          size="sm"
          variant="ghost"
          icon={<RotateCcw className="size-4" strokeWidth={1.8} aria-hidden />}
          disabled={percent === DEFAULT_SCALE}
          onClick={() => set(DEFAULT_SCALE)}
        >
          {m.reset}
        </Button>
      </div>
    </div>
  )
}

function LanguageSetting() {
  const m = useMessages(settingsMessages)
  const choice = useLanguage((s) => s.choice)
  const set = useLanguage((s) => s.set)
  const id = useId()
  const help = useId()
  const options = [
    { value: "system" as const, label: m.system(ENDONYMS[systemLang()]) },
    ...LANGS.map((lang) => ({ value: lang, label: ENDONYMS[lang] })),
  ]
  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 id={id} className="font-medium">
          {m.language}
        </h3>
        <p id={help} className="mt-1 max-w-[60ch] text-[0.9rem] text-ink-soft">
          {m.languageHelp}
        </p>
      </div>
      <Select<LangChoice>
        value={choice}
        onChange={set}
        options={options}
        aria-labelledby={id}
        aria-describedby={help}
        className="w-[16rem]"
      />
    </div>
  )
}
