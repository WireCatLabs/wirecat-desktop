import { useQuery } from "@tanstack/react-query"
import { useMessages } from "@/i18n"
import { platform } from "@/platform/bridge"
import { ClientCalls } from "@/shared/ClientCalls"
import { errorText } from "@/shared/errors"
import { callMessages } from "@/shared/messages-calls"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Skeleton } from "@/ui/Skeleton"
import { Recent } from "./MatchDialog"
import { peopleMessages } from "./messages"
import { usePeople } from "./store"

/**
 * What reaches them from outside the CRM, from memo's context of the person: their latest messages and mail, and their
 * calls. A memo from before cli-core 0.650.0 reads no calls, and the card shows none.
 */
export function PersonContacts({ reference }: { reference: string }) {
  const m = useMessages(peopleMessages)
  const c = useMessages(callMessages)
  const read = useQuery({
    queryKey: ["people", "contacts", reference] as const,
    queryFn: () => platform.peopleProfile(reference),
    staleTime: 60_000,
  })
  if (read.isPending) return <Skeleton className="h-[5rem] w-full rounded-control" label={c.loadingContacts} />
  if (read.isError)
    return (
      <ErrorNotice inline raw={errorText(read.error)}>
        {c.contactsFailed}
      </ErrorNotice>
    )
  const { recent, meetings } = read.data
  return (
    <div className="flex min-w-0 flex-col gap-[1.4rem] empty:hidden">
      {recent.length > 0 && (
        <section className="flex min-w-0 flex-col gap-[0.4rem]" aria-label={m.recent}>
          <h3 className="font-medium">{m.recent}</h3>
          <Recent items={recent} onLeave={() => usePeople.getState().reveal(null)} />
        </section>
      )}
      {meetings && <ClientCalls calls={meetings} help={c.personHelp} />}
    </div>
  )
}
