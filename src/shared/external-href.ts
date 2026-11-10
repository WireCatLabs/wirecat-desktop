/** Marks an element that opens this web address, so a right-click on it offers the address to copy (`LinkMenu`). */
export const EXTERNAL_HREF = "data-external-href"

export const externalHref = (url: string) => ({ [EXTERNAL_HREF]: url })
