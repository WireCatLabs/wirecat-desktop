import { gapFromRead } from "@/domain/needs"
import { useMessages } from "@/i18n"
import { errorText } from "@/shared/errors"
import { Page, PageHeader } from "@/shared/Page"
import { PageError } from "@/shared/PageError"
import { ToolNeeded } from "@/shared/ToolNeeded"
import { RefreshButton } from "@/ui/RefreshButton"
import { readAgain, useDocumentsPage, useDocumentsRead } from "./api"
import { DocumentDialog } from "./DocumentDialog"
import { DocumentsTable } from "./DocumentsTable"
import { FolderTree } from "./FolderTree"
import { documentMessages } from "./messages"
import { useDocuments } from "./store"

export function DocumentsPage() {
  const m = useMessages(documentMessages)
  const read = useDocumentsRead()
  const data = read.data
  const gap = gapFromRead(data?.kind === "missing" || data?.kind === "old" ? data : null)
  const sources = data?.kind === "ready" ? data.sources : null
  const asked = useDocuments((s) => s.asked)
  const page = useDocuments((s) => s.page)
  const size = useDocuments((s) => s.size)
  // Read beside the tree, not after it: two memo runs at once instead of one after the other.
  const list = useDocumentsPage(asked, page, size, !read.error && !gap)

  return (
    <Page className="@container">
      <PageHeader
        title={m.title}
        section="documents"
        intro={m.intro}
        actions={
          !gap &&
          !read.error &&
          !list.error && (
            <RefreshButton
              busy={read.isFetching}
              onClick={() => void readAgain()}
              label={m.readAgain}
              busyLabel={m.readingNow}
            />
          )
        }
      />
      {read.error ? (
        <PageError
          raw={errorText(read.error)}
          what="Reading documents"
          busy={read.isFetching}
          onRetry={() => void readAgain()}
        >
          {m.readFailed}
        </PageError>
      ) : gap ? (
        <ToolNeeded gap={gap} />
      ) : (
        // The tree beside the list it narrows; below about 52rem of page they stack, as the Agents tab does.
        <div className="grid items-start gap-[1.5rem] @min-[52rem]:grid-cols-[15rem_minmax(0,1fr)] @min-[80rem]:grid-cols-[17rem_minmax(0,1fr)]">
          <FolderTree sources={sources} />
          <DocumentsTable sources={sources} list={list} />
        </div>
      )}
      <DocumentDialog />
    </Page>
  )
}
