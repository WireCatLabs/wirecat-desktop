import { describe, expect, it } from "vitest"
import { WEBHOOK_SCOPES } from "../../domain/bitrix-signin"
import { bitrixMessages } from "./messages-bitrix"

describe("the missing-rights hint", () => {
  it.each(Object.entries(bitrixMessages))("names every right b24 needs, in %s", (_, text) => {
    for (const code of WEBHOOK_SCOPES) {
      expect(text.problem.scope.cause).toContain(code)
      expect(text.app.problem.scope.cause).toContain(code)
    }
  })
})
