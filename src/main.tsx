import { loadCommunityTools } from "./features/tools/community"

// Pages build some lists when their module loads (Storage areas, Search sources), so the interface is imported only
// after the community tools joined the catalog.
loadCommunityTools().then(() => import("./start"))
