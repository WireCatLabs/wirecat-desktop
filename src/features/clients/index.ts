import type { Kind } from "@/domain/clients"
import { useNav } from "@/shared/nav"
import { useClients } from "./store"

export { ClientsPage } from "./ClientsPage"
export { useClients } from "./store"

/** Clients on the deals or leads with this card's details open, from another page. */
export function openCard(kind: Kind, ref: string) {
  const clients = useClients.getState()
  if (clients.kind !== kind) clients.setKind(kind)
  clients.setOpen(ref)
  useNav.getState().go("clients")
}
