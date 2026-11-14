import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { localCountry, PHONE_COUNTRIES, sourceProblem, sourceSettings } from "@/domain/asterisk-source"
import { platform } from "@/platform/bridge"
import { useOnboarding } from "@/shared/onboarding-store"
import { useSignIn } from "@/shared/signin-store"
import { reduceMotion } from "@/testing/motion"
import { act, render, screen, within } from "@/testing/render"
import { SignInDialog } from "./SignInDialog"

describe("asterisk's source settings", () => {
  it("needs the path of Master.csv, or a database's server, name and user", () => {
    expect(sourceProblem("csv", {})).toEqual({ field: "cdr_csv_path", kind: "empty" })
    expect(sourceProblem("csv", { cdr_csv_path: " /srv/Master.csv " })).toBeNull()
    expect(sourceProblem("mysql", { db_host: "pbx", db_name: "asteriskcdrdb" })).toEqual({
      field: "db_user",
      kind: "empty",
    })
    expect(sourceProblem("postgres", { db_host: "pbx", db_port: "70000", db_name: "cdr", db_user: "r" })).toEqual({
      field: "db_port",
      kind: "port",
    })
  })

  it("saves the source first and leaves an optional field it was not given to the tool's default", () => {
    expect(sourceSettings("csv", { cdr_csv_path: "/srv/Master.csv", db_host: "ignored" }, null)).toEqual([
      ["cdr_source", "csv"],
      ["cdr_csv_path", "/srv/Master.csv"],
    ])
    const typed = { db_host: "pbx", db_name: "cdr", db_user: "r", recordings_path: "/rec" }
    expect(sourceSettings("mysql", typed, null)).toEqual([
      ["cdr_source", "mysql"],
      ["db_host", "pbx"],
      ["db_name", "cdr"],
      ["db_user", "r"],
      ["db_tls", "false"],
      ["recordings_path", "/rec"],
    ])
  })

  it("saves the countries as chosen, the system's country until then, and nothing once all are taken off", () => {
    const csv = { cdr_csv_path: "/srv/Master.csv" }
    expect(sourceSettings("csv", { ...csv, phone_region: "ru,es" }, "gb").at(-1)).toEqual(["phone_region", "ru,es"])
    expect(sourceSettings("csv", csv, "gb").at(-1)).toEqual(["phone_region", "gb"])
    expect(sourceSettings("csv", { ...csv, phone_region: "" }, "gb").map(([key]) => key)).not.toContain("phone_region")
  })

  it("takes the default from the system language's region, only when cli-core's phone rules know it", () => {
    expect(localCountry(["ru-RU", "en-US"])).toBe("ru")
    expect(localCountry(["en", "es-ES"])).toBe("es")
    expect(localCountry(["ja-JP", "zh-Hant"])).toBeNull()
    expect(localCountry(["not a tag"])).toBeNull()
  })

  it("lists the countries of PHONE_COUNTRIES in @wirecat/cli-core 0.656.0 (dist/domain/phone-plans.generated.js)", () => {
    expect(PHONE_COUNTRIES).toHaveLength(47)
    expect(PHONE_COUNTRIES.slice(0, 5)).toEqual(["us", "ca", "gb", "ie", "es"])
    expect(PHONE_COUNTRIES.at(-1)).toBe("tr")
  })
})

describe("asterisk's sign-in plan", () => {
  beforeEach(() => {
    reduceMotion()
    useOnboarding.setState({ open: false })
    vi.spyOn(platform, "signIn").mockResolvedValue()
    vi.spyOn(platform, "signInStop").mockResolvedValue()
    vi.spyOn(platform, "settingsSet").mockResolvedValue()
    vi.spyOn(navigator, "languages", "get").mockReturnValue(["en-US"])
  })

  afterEach(() => {
    act(() => useSignIn.getState().close())
    vi.restoreAllMocks()
  })

  const open = () => {
    render(<SignInDialog />)
    act(() => useSignIn.getState().start("pbx", "office"))
    return screen.getByRole("dialog", { name: "Sign in to Asterisk" })
  }

  it("checks Master.csv with no password, after saving where it is", async () => {
    const dialog = open()
    await userEvent.click(within(dialog).getByRole("button", { name: "Start sign-in" }))
    const path = within(dialog).getByLabelText("Path of Master.csv")
    expect(path).toHaveAttribute("aria-invalid", "true")
    expect(path).toHaveFocus()
    expect(within(dialog).queryByLabelText("Password of the database user")).not.toBeInTheDocument()

    await userEvent.type(path, "/srv/pbx/Master.csv")
    await userEvent.click(within(dialog).getByRole("button", { name: "Start sign-in" }))
    await vi.waitFor(() => expect(platform.signIn).toHaveBeenCalled())
    expect(vi.mocked(platform.settingsSet).mock.calls).toEqual([
      ["pbx", "office", false, "cdr_source", "csv"],
      ["pbx", "office", false, "cdr_csv_path", "/srv/pbx/Master.csv"],
      ["pbx", "office", false, "phone_region", "us"],
    ])
    const [, method, profile, , inputs] = vi.mocked(platform.signIn).mock.calls[0] ?? []
    expect([method, profile, inputs]).toEqual(["csv", "office", {}])
  })

  it("asks a database's password and sends it only as the run's input, never as a setting", async () => {
    const dialog = open()
    await userEvent.click(within(dialog).getByRole("radio", { name: /MySQL or MariaDB/ }))
    await userEvent.type(within(dialog).getByLabelText("Database server"), "pbx.office.lan")
    await userEvent.type(within(dialog).getByLabelText("Database name"), "asteriskcdrdb")
    await userEvent.type(within(dialog).getByLabelText("User"), "reader")
    await userEvent.click(within(dialog).getByRole("button", { name: "Start sign-in" }))
    const password = within(dialog).getByLabelText("Password of the database user")
    expect(password).toHaveAttribute("aria-invalid", "true")
    expect(platform.settingsSet).not.toHaveBeenCalled()

    await userEvent.type(password, "s3cr3t")
    await userEvent.click(within(dialog).getByRole("button", { name: "Start sign-in" }))
    await vi.waitFor(() => expect(platform.signIn).toHaveBeenCalled())
    const saved = vi.mocked(platform.settingsSet).mock.calls.map(([, , , key, value]) => [key, value])
    expect(saved).toEqual([
      ["cdr_source", "mysql"],
      ["db_host", "pbx.office.lan"],
      ["db_name", "asteriskcdrdb"],
      ["db_user", "reader"],
      ["db_tls", "false"],
      ["phone_region", "us"],
    ])
    const [, method, , , inputs] = vi.mocked(platform.signIn).mock.calls[0] ?? []
    expect([method, inputs]).toEqual(["mysql", { password: "s3cr3t" }])
  })

  const savedRegion = () =>
    vi.mocked(platform.settingsSet).mock.calls.find(([, , , key]) => key === "phone_region")?.[4]

  it("starts from the system's country and saves the countries in the order they were picked", async () => {
    vi.spyOn(navigator, "languages", "get").mockReturnValue(["ru-RU"])
    const dialog = open()
    await userEvent.type(within(dialog).getByLabelText("Path of Master.csv"), "/srv/pbx/Master.csv")
    const countries = within(dialog).getByRole("button", { name: "Countries: Russia" })
    await userEvent.click(countries)
    await userEvent.type(within(document.body).getByRole("combobox", { name: "Find countries" }), "spa{Enter}")
    await userEvent.keyboard("{Escape}")
    expect(countries).toHaveAccessibleName("Countries: Russia, Spain")
    await userEvent.click(within(dialog).getByRole("button", { name: "Start sign-in" }))
    await vi.waitFor(() => expect(platform.signIn).toHaveBeenCalled())
    expect(savedRegion()).toBe("ru,es")
  })

  it("saves no countries once the owner takes them all off", async () => {
    const dialog = open()
    await userEvent.type(within(dialog).getByLabelText("Path of Master.csv"), "/srv/pbx/Master.csv")
    await userEvent.click(within(dialog).getByRole("button", { name: "Clear countries" }))
    expect(within(dialog).getByRole("button", { name: "Countries: None chosen" })).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole("button", { name: "Start sign-in" }))
    await vi.waitFor(() => expect(platform.signIn).toHaveBeenCalled())
    expect(savedRegion()).toBeUndefined()
  })
})
