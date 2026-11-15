import { useMutation, useQuery } from "@tanstack/react-query"
import { Disc, ExternalLink, Play } from "lucide-react"
import { useEffect, useState } from "react"
import { findTool } from "@/domain/catalog"
import { toolOfProvider } from "@/domain/links"
import { useMessages } from "@/i18n"
import type { MeetingFound, MeetingRow } from "@/platform/bindings"
import { platform } from "@/platform/bridge"
import { errorText } from "@/shared/errors"
import { profilesQuery } from "@/shared/query"
import { Button } from "@/ui/Button"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Skeleton } from "@/ui/Skeleton"
import { meetingMessages } from "./messages"

type Source = MeetingRow["sources"][number]

/** The meeting record whose tool can say where the recording is: a source of a WireCat tool, with its `meeting:` ref. */
export const recordingSource = (meeting: MeetingRow): (Source & { ref: string; tool: string }) | null => {
  if (!meeting.hasRecording) return null
  for (const s of meeting.sources) {
    const tool = findTool(toolOfProvider(s.provider))
    if (s.via === "meeting" && s.ref?.startsWith("meeting:") && tool) return { ...s, ref: s.ref, tool: tool.id }
  }
  return null
}

/**
 * The recording, read in the tool that recorded it as the profile its account is: played here when it is a file on
 * this computer, else said where it is. Nothing is read until the owner presses Listen.
 */
export function Recording({ meeting }: { meeting: MeetingRow }) {
  const m = useMessages(meetingMessages)
  const source = recordingSource(meeting)
  const profiles = useQuery({ ...profilesQuery(source?.tool ?? ""), enabled: source !== null })
  const profile = source && profiles.data?.some((p) => p.name === source.account) ? source.account : null
  const found = useQuery({
    queryKey: ["tool", source?.tool, "recording", profile, source?.ref],
    queryFn: () => platform.meetingFind(source?.provider ?? "", profile ?? "", source?.ref ?? ""),
    enabled: source !== null && profile !== null,
    staleTime: 60_000,
  })
  if (!source) return null
  const pending = profiles.isPending || (profile !== null && found.isPending)
  const recording = found.data?.recording
  let body: React.ReactNode
  if (pending) body = <Skeleton className="h-[1.2rem] w-[14rem]" label={m.reading} />
  else if (recording?.kind === "here") body = <Player source={source} profile={profile ?? ""} {...recording} />
  else if (recording?.kind === "gone") body = <span className="text-ink-soft">{m.recordingGone}</span>
  else if (recording?.kind === "elsewhere" && source.provider === "asterisk")
    body = <span className="text-ink-soft">{m.recordingOnPbx(findTool(source.tool)?.name ?? source.tool)}</span>
  else body = <span className="text-ink-soft">{m.recordingKept}</span>
  return (
    <div className="flex flex-wrap items-center gap-x-[0.8rem] gap-y-[0.4rem] text-[0.95rem]">
      <span className="inline-flex items-center gap-[0.35rem] text-ink-soft">
        <Disc className="size-4" aria-hidden />
        {m.recording}
      </span>
      {body}
    </div>
  )
}

type Here = Extract<MeetingFound["recording"], { kind: "here" }>

function Player({ source, profile, mime, tooLarge }: { source: Source & { ref: string }; profile: string } & Here) {
  const m = useMessages(meetingMessages)
  const [url, setUrl] = useState<string | null>(null)
  const [broken, setBroken] = useState(false)
  // WebKitGTK and WebView2 play WAV, MP3 and Ogg, but not the GSM or raw formats Asterisk can write.
  const playable = !tooLarge && !!mime && document.createElement("audio").canPlayType(mime) !== ""
  const load = useMutation({
    mutationFn: () => platform.meetingRecordingRead(source.provider, profile, source.ref),
    onSuccess: (bytes) => setUrl(URL.createObjectURL(new Blob([bytes], { type: mime ?? "audio/wav" }))),
  })
  const open = useMutation({ mutationFn: () => platform.meetingRecordingOpen(source.provider, profile, source.ref) })
  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url])
  const openButton = (
    <Button
      size="sm"
      variant="secondary"
      icon={<ExternalLink className="size-4" aria-hidden />}
      busy={open.isPending}
      onClick={() => open.mutate()}
    >
      {m.openInPlayer}
    </Button>
  )
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-[0.6rem]">
      {!playable || broken ? (
        <span className="text-ink-soft">{tooLarge ? m.recordingTooLarge : m.recordingFormat}</span>
      ) : url ? (
        // biome-ignore lint/a11y/useMediaCaption: a phone call's recording has no captions; its transcript is the text
        <audio
          controls
          autoPlay
          src={url}
          className="h-[2.2rem] max-w-full"
          onError={() => setBroken(true)}
          aria-label={m.recording}
        />
      ) : (
        <Button
          size="sm"
          variant="primary"
          icon={<Play className="size-4" aria-hidden />}
          busy={load.isPending}
          onClick={() => load.mutate()}
        >
          {m.listen}
        </Button>
      )}
      {openButton}
      {(load.error || open.error) && (
        <ErrorNotice inline raw={errorText(load.error ?? open.error)}>
          {m.recordingFailed}
        </ErrorNotice>
      )}
    </span>
  )
}
