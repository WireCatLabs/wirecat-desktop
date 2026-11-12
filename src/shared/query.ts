import { focusManager, QueryClient, queryOptions } from "@tanstack/react-query"
import { platform } from "@/platform/bridge"

// react-query watches only whether the page is visible. The desktop window stays visible while the owner works in a
// browser, so coming back to it is a focus event; only a query that sets refetchOnWindowFocus reads again then.
focusManager.setEventListener((onFocus) => {
  const back = () => onFocus()
  window.addEventListener("focus", back)
  document.addEventListener("visibilitychange", back)
  return () => {
    window.removeEventListener("focus", back)
    document.removeEventListener("visibilitychange", back)
  }
})

// A failed call is a tool's own answer (not installed, refused), not a dropped packet: asking again at once gives the
// same answer later. Focus and reconnect would start tool processes the owner did not ask for.
const create = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false, refetchOnReconnect: false },
      mutations: { retry: false },
    },
  })

let client = create()

/** The one client: the provider in `app/` hands it to hooks, and stores outside React read and refresh it. */
export const queryClient = () => client

/** A new, empty client; the test setup calls it before each test so no answer leaks into the next one. */
export function resetQueryClient() {
  client.clear()
  client = create()
}

/** A tool's profiles. Several features list them, so they share one key and one answer. */
export const profilesQuery = (id: string) =>
  queryOptions({ queryKey: ["tool", id, "profiles"], queryFn: () => platform.listProfiles(id) })

/**
 * A tool's profiles for a store outside React: pages that open together ask once, and a page opened within 10 s takes
 * that answer. Short, because a sign-in elsewhere changes it.
 */
export const listProfiles = (id: string) => client.fetchQuery({ ...profilesQuery(id), staleTime: 10_000 })
