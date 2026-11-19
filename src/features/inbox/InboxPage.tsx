import { useQuery } from "@tanstack/react-query"
import { Sparkles } from "lucide-react"
import { useEffect } from "react"
import { findTool } from "@/domain/catalog"
import { ACCOUNT_FIELD, refusalOf } from "@/domain/inbox"
import { useMessages } from "@/i18n"
import type { InboxAccount } from "@/platform/bindings"
import { accountTitle, useAccountNames } from "@/shared/account-names-store"
import { useAiModel } from "@/shared/ai-model-store"
import { errorText } from "@/shared/errors"
import { filterField } from "@/shared/filter-field"
import { goAiModel } from "@/shared/go-ai-model"
import { useNeed } from "@/shared/needs"
import { Page, PageHeader } from "@/shared/Page"
import { profilesQuery } from "@/shared/query"
import { ToolNeeded } from "@/shared/ToolNeeded"
import { Button } from "@/ui/Button"
import { EmptyState } from "@/ui/EmptyState"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { FilterBar } from "@/ui/FilterBar"
import { FilterMenu } from "@/ui/FilterMenu"
import { PAGE_SIZES, Pager } from "@/ui/Pager"
import { Skeleton } from "@/ui/Skeleton"
import { EMAIL, useInboxPage } from "./api"
import { InboxGroups, InboxGroupsLoading } from "./InboxGroups"
import { inboxMessages } from "./messages"
import { SortRuns } from "./SortRuns"
import { useInbox } from "./store"

const INBOX_SECTION = "inbox"

/** The model the owner chose, as its name; null while memo has not answered or nothing is chosen. */
function useModel() {
  const model = useAiModel((s) => s.model)
  const error = useAiModel((s) => s.error)
  useEffect(() => {
    const ai = useAiModel.getState()
    if (ai.model === null && ai.error === null) void ai.load()
  }, [])
  return { chosen: model ? (model.provider ? (model.model ?? model.provider) : null) : undefined, error }
}

/**
 * The Inbox tab of Digests: every mail account's threads the AI model sorted, together, under needs an answer, to read
 * and can wait. Sort now runs `inbox` for every account; a row opens its thread on the conversation page.
 */
export function InboxPage() {
  const m = useMessages(inboxMessages)
  const gap = useNeed({ anyOf: [EMAIL], minVersion: findTool(EMAIL)?.mailInbox?.minVersion ?? null, signedIn: true })
  const profiles = useQuery({ ...profilesQuery(EMAIL), enabled: gap === null })
  const names = (profiles.data ?? []).map((p) => p.name)
  const model = useModel()
  const sorting = useInbox((s) => s.sorting)
  // The no-model notice goes above the list: the body waits for memo's answer, so it never pushes the list down.
  const known = model.chosen !== undefined || model.error !== null
  const status = sorting ? m.sorting : model.chosen ? m.sortHint(model.chosen) : null
  return (
    <Page>
      <PageHeader
        title={m.title}
        section={INBOX_SECTION}
        intro={m.intro}
        {...(status === null ? {} : { status })}
        busy={sorting}
        actions={
          !gap &&
          model.chosen && (
            <Button
              size="sm"
              variant="primary"
              busy={sorting}
              icon={<Sparkles className="size-4" aria-hidden />}
              onClick={() => void useInbox.getState().sortNow(names)}
            >
              {sorting ? m.sorting : m.sortNow}
            </Button>
          )
        }
      />
      {gap ? (
        <ToolNeeded gap={gap} />
      ) : (
        <div className="flex flex-col gap-[1.5rem]">
          {!known && (
            <div className="flex flex-col gap-[1rem]">
              <Skeleton className="h-[2.8rem] w-full" />
              <InboxGroupsLoading label={m.reading} />
            </div>
          )}
          {model.chosen === null && <NoModel />}
          {model.error !== null && model.chosen === undefined && (
            <ErrorNotice
              raw={model.error}
              action={
                <Button size="sm" variant="ghost" onClick={goAiModel}>
                  {m.goAiModel}
                </Button>
              }
            >
              {m.modelFailed}
            </ErrorNotice>
          )}
          {known && <SortRuns />}
          {known && <Sorted profiles={profiles.data === undefined ? undefined : names} />}
        </div>
      )}
    </Page>
  )
}

function NoModel() {
  const m = useMessages(inboxMessages)
  return (
    <EmptyState
      title={m.noModelTitle}
      action={
        <Button size="sm" variant="primary" onClick={goAiModel}>
          {m.goAiModel}
        </Button>
      }
    >
      {m.noModelBody}
    </EmptyState>
  )
}

/** The list: filters, the groups of one page, the pager. Placeholders keep the shape of a page of rows. */
function Sorted({ profiles }: { profiles: string[] | undefined }) {
  const m = useMessages(inboxMessages)
  const { query, asked, page, pageSize, type, setQuery, setPage, setPageSize } = useInbox()
  const answer = useInboxPage(profiles, asked, page, pageSize)
  const names = useAccountNames((s) => s.names)
  const data = answer.data
  const accounts = data?.accounts ?? []
  const failed = accounts.filter((a): a is Extract<InboxAccount, { result: "failed" }> => a.result === "failed")
  const title = (profile: string) => accountTitle(names, EMAIL, profile)

  return (
    <div className="flex flex-col gap-[1rem]">
      <FilterBar
        query={query}
        onQuery={type}
        onClear={() => setQuery("")}
        label={m.search}
        placeholder={m.placeholder}
        inline
      >
        <FilterMenu
          label={m.account}
          {...filterField(
            query,
            setQuery,
            ACCOUNT_FIELD,
            (profiles ?? []).map((p) => {
              const read = accounts.find((a) => a.profile === p)
              return { value: p, label: title(p), count: read?.result === "listed" ? read.matching : undefined }
            }),
          )}
        />
      </FilterBar>
      {failed.map((a) => {
        const why = refusalOf(a)
        return (
          <ErrorNotice key={a.profile} tone="warn" raw={a.message}>
            {m.readFailed(title(a.profile))} {why === "other" ? "" : m.refusal[why]}
          </ErrorNotice>
        )
      })}
      {answer.error ? (
        <ErrorNotice raw={errorText(answer.error)}>{m.listFailed}</ErrorNotice>
      ) : !data ? (
        <InboxGroupsLoading label={m.reading} />
      ) : data.total === 0 ? (
        query ? (
          <EmptyState
            action={
              <Button size="sm" variant="ghost" onClick={() => setQuery("")}>
                {m.clear}
              </Button>
            }
          >
            {m.noMatch}
          </EmptyState>
        ) : (
          <EmptyState title={m.emptyTitle}>{m.emptyBody}</EmptyState>
        )
      ) : (
        <InboxGroups page={data} busy={answer.isPlaceholderData} title={title} />
      )}
      {data && data.total > PAGE_SIZES[0] && (
        <Pager
          page={page}
          onPage={setPage}
          total={data.total}
          size={pageSize}
          sizes={PAGE_SIZES}
          onSize={setPageSize}
          busy={answer.isFetching}
        />
      )}
    </div>
  )
}
