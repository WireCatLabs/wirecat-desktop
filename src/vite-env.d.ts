/// <reference types="vite/client" />

declare const __APP_VERSION__: string
/** The commit the interface was built from, short form; null when built outside git. */
declare const __BUILD_COMMIT__: string | null
declare const __BUILD_DATE__: string | null
/** True in builds that may run in a browser (dev, tests, `pnpm build`); false in the Tauri bundle. */
declare const __WITH_MOCK__: boolean
