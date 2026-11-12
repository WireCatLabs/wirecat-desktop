import { readdirSync, readFileSync } from "node:fs"
import { join, relative } from "node:path"
import { describe, expect, it } from "vitest"

const SRC = join(__dirname, "..")

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name)
    if (e.isDirectory()) return files(path)
    return e.name.endsWith(".tsx") && !e.name.includes(".test.") ? [path] : []
  })
}

const using = (pattern: RegExp, allowed: string[]) =>
  files(SRC)
    .map((f) => relative(SRC, f))
    .filter((f) => !allowed.includes(f) && pattern.test(readFileSync(join(SRC, f), "utf8")))

describe("one component per job (docs/dev/ui-consistency.md)", () => {
  it("draws a page title only in PageHeader", () => {
    expect(using(/<h1\b/, ["shared/Page.tsx", "app/ErrorBoundary.tsx", "features/onboarding/Onboarding.tsx"])).toEqual(
      [],
    )
  })

  it("draws a notice's border and tint only through ui/notice", () => {
    const box =
      /(?<!:)border-(warn|bad)\/\d+[^"]*(?<!:)bg-(warn|bad)\/|(?<!:)bg-(warn|bad)\/\d+[^"]*(?<!:)border-(warn|bad)\//
    expect(using(box, ["ui/NoticeChips.tsx"])).toEqual([])
  })

  it("writes to the clipboard only in CopyButton, which says when a copy fails", () => {
    // LinkMenu offers a hand copy of the address on failure; McpServerRow copies a value it asks Rust for first.
    expect(
      using(/navigator\.clipboard/, ["ui/CopyButton.tsx", "app/LinkMenu.tsx", "features/tools/McpServerRow.tsx"]),
    ).toEqual([])
  })

  it("writes a field's error only through FieldError (rule 10)", () => {
    // A red line that a field points at by id: a field error written by hand, without the focus move or the Collapse.
    const handError =
      /<(?:p|span|div)\b[^>]*\bid=[^>]*\btext-bad\b[^>]*>|<(?:p|span|div)\b[^>]*\btext-bad\b[^>]*\bid=[^>]*>/
    expect(
      using(handError, [
        "ui/FieldError.tsx",
        // A length counter that turns red; the field is not refused.
        "features/digests/BriefCard.tsx",
        // Live lines that switch between a hint and a problem as the owner types; not yet moved to the hook.
        "features/query/QueryBar.tsx",
        "features/search/QueryDraft.tsx",
        "features/storage/BackupPassword.tsx",
        // Its own problem order across a group of fields (data-problem), focused by the form.
        "features/digests/ScheduleCard.tsx",
      ]),
    ).toEqual([])
  })

  it("repeats the page frame only in Page and in the first-run setup", () => {
    expect(using(/px-\[2\.1rem\]/, ["shared/Page.tsx", "features/onboarding/Onboarding.tsx"])).toEqual([])
  })
})
