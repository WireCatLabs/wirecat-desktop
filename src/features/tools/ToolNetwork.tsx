import { useQuery } from "@tanstack/react-query"
import { useMessages } from "@/i18n"
import { platform } from "@/platform/bridge"
import { networkMessages } from "./messages-network"

/**
 * The servers the installed version declares in its own `contracts/wirecat.json`, as the tool words them. A version
 * that ships none says so; nothing is guessed from its code here (own tools get that scan in their review).
 */
export function ToolNetworkDetails({ id }: { id: string }) {
  const m = useMessages(networkMessages)
  const read = useQuery({ queryKey: ["tool", id, "network"] as const, queryFn: () => platform.toolNetwork(id) })
  const net = read.data
  if (!net || net.kind === "notInstalled") return null
  return (
    <div>
      <h4 className="mb-2 text-[0.9rem] font-medium text-ink-dim">{m.heading}</h4>
      {net.kind === "undeclared" ? (
        <p className="text-[0.875rem] text-ink-soft">{m.undeclared}</p>
      ) : (
        <div className="flex flex-col gap-1 text-[0.875rem] text-ink-soft">
          {net.hosts.length === 0 ? (
            <p>{m.none}</p>
          ) : (
            <>
              <p>{m.hosts}</p>
              <ul className="flex flex-wrap gap-x-3 gap-y-1">
                {net.hosts.map((h) => (
                  <li key={h}>
                    <code className="selectable font-mono text-ink">{h}</code>
                  </li>
                ))}
              </ul>
            </>
          )}
          {net.userHosts && <p>{m.userHosts(net.userHosts)}</p>}
        </div>
      )}
    </div>
  )
}
