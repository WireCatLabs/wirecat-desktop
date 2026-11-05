import { loadCommunityTools } from "@/features/tools/community"
import { initPlatform } from "@/platform/bridge"

// Pages build some lists when their module loads (Storage areas, Search sources), so the interface is imported only
// after the platform is chosen and the community tools joined the catalog.
initPlatform()
  .then(loadCommunityTools)
  .then(() => import("./start"))
