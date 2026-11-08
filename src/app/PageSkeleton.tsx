import { Skeleton } from "@/ui/Skeleton"

/** Same frame as every page (padding, 2.1rem title line), so a page arriving does not move the column. */
export function PageSkeleton() {
  return (
    <div data-page-loading className="flex flex-col gap-[1.5rem] px-[2.1rem] pt-[1.6rem] pb-[2.2rem]">
      <div>
        <Skeleton className="h-[2.1rem] w-[14rem]" />
        <Skeleton className="mt-3 h-[1.4rem] w-[min(72ch,100%)]" />
      </div>
      <Skeleton className="h-[16rem] w-full" />
    </div>
  )
}
