import { useIsFetching } from "@tanstack/react-query"
import { gapFromRead } from "@/domain/needs"
import { type Lang, useLang, useMessages } from "@/i18n"
import { errorText } from "@/shared/errors"
import { Page, PageHeader } from "@/shared/Page"
import { PageError } from "@/shared/PageError"
import { ToolNeeded } from "@/shared/ToolNeeded"
import { RefreshButton } from "@/ui/RefreshButton"
import { readAgain, useDocumentsRead } from "./api"
import { DocumentDialog } from "./DocumentDialog"
import { DocumentsTable } from "./DocumentsTable"
import { FolderTree } from "./FolderTree"
import { documentMessages } from "./messages"

const guide = (lang: Lang) => `https://wirecat.dev/${lang}/docs/memo/documents`

export function DocumentsPage() {
  const m = useMessages(documentMessages)
  const lang = useLang()
  const read = useDocumentsRead()
  const reading = useIsFetching({ queryKey: ["tool", "memo", "documents"] }) > 0
  const data = read.data
  const gap = gapFromRead(data?.kind === "missing" || data?.kind === "old" ? data : null)
  const sources = data?.kind === "ready" ? data.sources : null

  return (
    <Page className="@container">
      <PageHeader
        title={m.title}
        section="documents"
        intro={m.intro}
        guide={{ label: m.guide, href: guide(lang) }}
        actions={
          !gap &&
          !read.error && (
            <RefreshButton
              busy={reading}
              onClick={() => void readAgain()}
              label={m.readAgain}
              busyLabel={m.readingNow}
            />
          )
        }
      />
      {read.error ? (
        <PageError raw={errorText(read.error)} what="Reading documents" busy={reading} onRetry={() => void readAgain()}>
          {m.readFailed}
        </PageError>
      ) : gap ? (
        <ToolNeeded gap={gap} />
      ) : (
        // The tree beside the list it narrows; below about 52rem of page they stack, as the Agents tab does.
        <div className="grid items-start gap-[1.5rem] @min-[52rem]:grid-cols-[13rem_minmax(0,1fr)] @min-[64rem]:grid-cols-[16rem_minmax(0,1fr)] @min-[80rem]:grid-cols-[18rem_minmax(0,1fr)]">
          <FolderTree sources={sources} />
          <DocumentsTable sources={sources} />
        </div>
      )}
      <DocumentDialog />
    </Page>
  )
}
