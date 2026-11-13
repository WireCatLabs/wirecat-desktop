import type { ReactNode } from "react"
import { Tab as AriaTab, type TabProps } from "react-aria-components"
import { cx } from "./cx"

export { TabList, TabPanel, Tabs } from "react-aria-components"

/** `data-tab` lets code outside the list focus a tab by its key: the library does not put the key in the DOM `id`. */
export function Tab({ id, ...rest }: TabProps & { id: string }) {
  return <AriaTab id={id} data-tab={id} {...rest} />
}

/**
 * The one look for content tabs: a label in a row, the selected one bold over a brand line. `md` inside a panel
 * (a tool's settings and JSON), `lg` for the tabs of a whole page (Tools and Agents). `extra` sits after the label.
 */
export function LineTab(props: {
  id: string
  children: ReactNode
  extra?: ReactNode
  size?: "md" | "lg"
  "data-tour"?: string
}) {
  const { id, children, extra, size = "md", ...rest } = props
  return (
    <Tab
      id={id}
      {...rest}
      className={({ isSelected }) =>
        cx(
          "relative flex items-center transition-colors duration-(--motion-fast)",
          size === "lg" ? "h-[3rem] text-[1.08rem]" : "h-[2.9rem] text-[0.95rem]",
          isSelected ? "font-semibold text-ink" : "text-ink-soft hover:text-ink",
        )
      }
    >
      {({ isSelected }) => (
        <>
          {children}
          {extra}
          <span
            aria-hidden
            className={cx(
              "absolute inset-x-0 bottom-0 h-[2px] rounded-t-full bg-brand transition-transform duration-(--motion-fast)",
              isSelected ? "scale-x-100" : "scale-x-0",
            )}
          />
        </>
      )}
    </Tab>
  )
}
