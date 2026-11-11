import { cx } from "./cx"

export type NoticeTone = "bad" | "warn"

/** The corners, border and tint of a notice, for one that sets its own padding. */
export const noticeFrame = (tone: NoticeTone) =>
  cx("rounded-[0.2rem] border", tone === "bad" ? "border-bad/40 bg-bad/10" : "border-warn/40 bg-warn/10")

/** A notice with content `ErrorNotice` cannot hold (a list, a form, several buttons). */
export const noticeBox = (tone: NoticeTone) => cx(noticeFrame(tone), "px-4 py-3")
