import { useMessages } from "@/i18n"
import { Page, PageHeader } from "@/shared/Page"
import { AppPreferences } from "./AppPreferences"
import { settingsMessages } from "./messages"

export function AppSettingsPage() {
  const m = useMessages(settingsMessages)
  return (
    <Page>
      <PageHeader title={m.title} intro={m.intro} />
      <AppPreferences />
    </Page>
  )
}
