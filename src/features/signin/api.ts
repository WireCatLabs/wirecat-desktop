import { useQuery } from "@tanstack/react-query"
import { parseSetup, type SetupDocument } from "@/domain/setup-flow"
import { platform } from "@/platform/bridge"
import { errorText } from "@/shared/errors"

export type SetupAnswer =
  | { kind: "loading" }
  | { kind: "flow"; document: SetupDocument; images: Record<string, string> }
  /** The tool predates the format, describes a flow this window cannot draw, or did not answer: the hand-made form. */
  | { kind: "hand"; why: string }

const ask = async (tool: string, profile: string): Promise<SetupAnswer> => {
  try {
    const shown = await platform.setupShow(tool, profile)
    const parsed = parseSetup(shown.document)
    return parsed.kind === "flow"
      ? { kind: "flow", document: parsed.document, images: shown.images }
      : { kind: "hand", why: parsed.why }
  } catch (e) {
    return { kind: "hand", why: errorText(e) }
  }
}

/**
 * The tool's own connection flow for the profile, asked when the sign-in opens on its plan and kept while it stays
 * open: a way back to the plan keeps the form it had. Any failure keeps the hand-made form; a tool from before
 * `setup show` refuses with "unknown command".
 */
export function useSetupDocument(tool: string | null, profile: string | null, opening: boolean): SetupAnswer {
  const q = useQuery({
    queryKey: ["tool", tool ?? "", "setup", profile ?? ""],
    queryFn: () => ask(tool ?? "", profile ?? ""),
    enabled: opening && tool !== null && profile !== null,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 0,
  })
  if (tool === null) return { kind: "hand", why: "the tool describes no flow of its own" }
  if (q.data) return q.data
  return opening ? { kind: "loading" } : { kind: "hand", why: "a run of the hand-made form" }
}
