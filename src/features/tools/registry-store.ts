import { create } from "zustand"
import { listNotice } from "@/domain/community-list"
import { platform } from "@/platform/bridge"
import type { CommunityStatus } from "@/platform/community-schemas"
import { perLang, useNotices } from "@/shared/notices-store"
import { communityToolsDocs } from "./community-docs"
import { registryMessages } from "./messages-registry"

const NOTICE = "community-list"

type RegistryState = {
  status: CommunityStatus | null
  check(): Promise<void>
}

/** The signed community list's state, read again on the bell's hourly timer: the app may cross the expiry while open. */
export const useRegistry = create<RegistryState>()((set) => ({
  status: null,
  async check() {
    const status = await platform.communityStatus().catch(() => null)
    if (!status) return
    set({ status })
    const notice = listNotice(status)
    const { raise, clear } = useNotices.getState()
    if (!notice) return clear(NOTICE)
    raise({
      id: NOTICE,
      key: `${notice.kind}:${status.expiresAt}`,
      tone: notice.kind === "expired" ? "bad" : "warn",
      text: perLang(registryMessages, (m, lang) =>
        notice.kind === "expired" ? m.expired : m.expiring(notice.days, notice.until, lang),
      ),
      link: {
        label: perLang(registryMessages, (m) => m.how),
        url: perLang(registryMessages, (_, l) => communityToolsDocs(l)),
      },
    })
  },
}))
