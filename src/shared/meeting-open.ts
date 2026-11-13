import { create } from "zustand"
import { useNav } from "./nav"

/**
 * The meeting whose details are open, and its title until they come. Here and not in the Meetings feature so the
 * Documents page can open one: Meetings already opens documents, and features never import each other both ways.
 */
export const useMeetingOpen = create<{ ref: string | null; title: string }>(() => ({ ref: null, title: "" }))

export function openMeeting(ref: string, title = "") {
  useMeetingOpen.setState({ ref, title })
  useNav.getState().go("meetings")
}
