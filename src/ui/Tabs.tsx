import { Tab as AriaTab, type TabProps } from "react-aria-components"

export { TabList, TabPanel, Tabs } from "react-aria-components"

/** `data-tab` lets code outside the list focus a tab by its key: the library does not put the key in the DOM `id`. */
export function Tab({ id, ...rest }: TabProps & { id: string }) {
  return <AriaTab id={id} data-tab={id} {...rest} />
}
