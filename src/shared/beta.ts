/** New and lightly tested sections: a β badge in the sidebar and beside the page title. Remove an id to drop it. */
export const BETA: readonly string[] = Object.freeze(["clients", "memory", "people", "meetings"])

export const isBeta = (id: string) => BETA.includes(id)
