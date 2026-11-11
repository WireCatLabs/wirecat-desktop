import { Page } from "@/shared/Page"
import { Skeleton } from "@/ui/Skeleton"

/** Same frame as every page (padding, 2.1rem title line), so a page arriving does not move the column. */
export function PageSkeleton() {
  return (
    <Page data-page-loading>
      <div>
        <Skeleton className="h-[2.1rem] w-[14rem]" />
        <Skeleton className="mt-3 h-[1.4rem] w-[min(72ch,100%)]" />
      </div>
      <Skeleton className="h-[16rem] w-full" />
    </Page>
  )
}
