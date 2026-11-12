import { FileText, LoaderCircle, ScanText } from "lucide-react"
import { useState } from "react"
import { toolOfProvider } from "@/domain/links"
import { useMessages } from "@/i18n"
import type { PictureRead } from "@/platform/ai-model-schemas"
import { platform } from "@/platform/bridge"
import { Button } from "@/ui/Button"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { errorText } from "./errors"
import { goSettingsAt } from "./go-ai-model"
import { fileActionMessages } from "./messages-file-actions"
import { ToolNeeded } from "./ToolNeeded"

/** The messengers whose CLI has `images read`; memo names their messages `msg:<provider>/…`. */
const READERS = ["tg", "max", "wa"]

export type FileFacts = { position: number; picture: boolean; saved: boolean }

export const readsPictures = (ref: string) =>
  READERS.includes(toolOfProvider(ref.match(/^msg:([a-z0-9-]+)\//)?.[1] ?? ""))

type Words = (typeof fileActionMessages)["en"]
type Shown =
  | { state: "idle" }
  | { state: "busy" }
  | { state: "done"; read: PictureRead }
  | { state: "failed"; why: string }

const AGENTS: Record<string, string> = { claude: "Claude Code", codex: "Codex" }

/** `agent:codex/gpt-5` as "Codex (gpt-5)". */
function readerOf(extractor: string | null): string | null {
  const [agent, model] = (extractor?.replace(/^agent:/, "") ?? "").split("/", 2)
  if (!agent) return null
  const name = AGENTS[agent] ?? agent
  return model ? `${name} (${model})` : name
}

function refusalText(why: string, m: Words): string | null {
  const unavailable = why.match(/^picture-reading\.unavailable:(claude|codex)$/)
  if (unavailable) return m.unavailable(unavailable[1] as "claude" | "codex")
  const worded: Record<string, string> = {
    "picture-reading.off": m.off,
    "picture-reading.not-a-picture": m.notPicture,
    "picture-reading.unavailable-file": m.unavailableFile,
    "picture-reading.failed": m.failed,
    "picture-reading.timeout": m.timeout,
  }
  return worded[why] ?? null
}

/**
 * "Read the picture" and "Open the file" for one file of a stored message. The text the agent read is the picture's
 * own words: shown as plain text, never as links.
 */
export function FileActions({ messageRef, file }: { messageRef: string; file: FileFacts }) {
  const m = useMessages(fileActionMessages)
  const [shown, setShown] = useState<Shown>({ state: "idle" })
  const [openError, setOpenError] = useState<string | null>(null)
  const canRead = file.picture && readsPictures(messageRef)
  if (!canRead && !file.saved) return null

  const read = async () => {
    setShown({ state: "busy" })
    try {
      setShown({ state: "done", read: await platform.pictureRead(messageRef, file.position) })
    } catch (e) {
      setShown({ state: "failed", why: errorText(e) })
    }
  }
  const open = async () => {
    setOpenError(null)
    try {
      await platform.attachmentOpen(messageRef, file.position)
    } catch (e) {
      setOpenError(errorText(e))
    }
  }
  const busy = shown.state === "busy"

  return (
    <div className="flex w-full flex-col gap-1.5">
      <div className="-ml-2 flex flex-wrap gap-1">
        {canRead && (
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            icon={
              busy ? (
                <LoaderCircle className="size-4 animate-spin" aria-hidden />
              ) : (
                <ScanText className="size-4" aria-hidden />
              )
            }
            onClick={() => void read()}
          >
            {m.read}
          </Button>
        )}
        {file.saved && (
          <Button
            size="sm"
            variant="ghost"
            icon={<FileText className="size-4" aria-hidden />}
            onClick={() => void open()}
          >
            {m.open}
          </Button>
        )}
      </div>
      {busy && (
        <p className="text-[0.85rem] text-ink-soft" aria-live="polite">
          {m.reading}
        </p>
      )}
      {shown.state === "done" && shown.read.state === "old" && (
        <ToolNeeded
          gap={{ kind: "old", tool: shown.read.tool, version: shown.read.version, need: shown.read.need }}
          inline
        />
      )}
      {shown.state === "done" && shown.read.state === "read" && (
        <figure className="flex flex-col gap-1">
          {readerOf(shown.read.extractor) && (
            <figcaption className="text-[0.82rem] text-ink-dim">
              {m.readBy(readerOf(shown.read.extractor) ?? "")}
            </figcaption>
          )}
          <p className="selectable max-h-[16rem] overflow-y-auto rounded-[0.35rem] border border-line bg-app-2/60 px-[0.8rem] py-[0.5rem] text-[0.9rem] break-words whitespace-pre-wrap text-ink">
            {shown.read.text || <span className="text-ink-dim">{m.empty}</span>}
          </p>
        </figure>
      )}
      {shown.state === "failed" && (
        <ErrorNotice
          inline
          raw={refusalText(shown.why, m) ? null : shown.why}
          action={
            shown.why === "picture-reading.off" || shown.why.startsWith("picture-reading.unavailable:") ? (
              <Button size="sm" onClick={() => goSettingsAt("picture-reading")}>
                {m.goSetting}
              </Button>
            ) : null
          }
        >
          {refusalText(shown.why, m) ?? m.readFailed}
        </ErrorNotice>
      )}
      {openError && (
        <ErrorNotice inline raw={openError}>
          {m.openFailed}
        </ErrorNotice>
      )}
    </div>
  )
}
