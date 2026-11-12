import type { Messages } from "@/i18n"

/** memo's refusals of a model's address that Rust passes on as their id, for every place that sets a model. */
export const MODEL_REFUSALS = ["model.address-refused", "local-only.refused"] as const
export type ModelRefusal = (typeof MODEL_REFUSALS)[number]

export const modelRefusalOf = (message: string): ModelRefusal | null =>
  MODEL_REFUSALS.find((r) => r === message.trim()) ?? null

const en: Record<ModelRefusal, string> = {
  "model.address-refused":
    "Memo refused this address. It is plain http to another computer, so your records and key would cross the network unencrypted. Use an https address, or a server on this computer (localhost).",
  "local-only.refused":
    "“Only this computer” is on in Settings, so Memo sends nothing to another computer. Choose a model on this computer, or turn that switch off in Settings.",
}

const ru: typeof en = {
  "model.address-refused":
    "Memo не принял этот адрес. Это http без шифрования к другому компьютеру, и записи с ключом пошли бы по сети открытыми. Укажите адрес https или сервер на этом компьютере (localhost).",
  "local-only.refused":
    "В настройках включено «Только этот компьютер», поэтому Memo ничего не отправляет на другие компьютеры. Выберите модель на этом компьютере или выключите этот переключатель в настройках.",
}

const es: typeof en = {
  "model.address-refused":
    "Memo rechazó esta dirección. Es http sin cifrar hacia otro ordenador, así que tus registros y tu clave cruzarían la red sin cifrar. Usa una dirección https o un servidor en este ordenador (localhost).",
  "local-only.refused":
    "«Solo este ordenador» está activado en Ajustes, así que Memo no envía nada a otro ordenador. Elige un modelo en este ordenador o desactiva ese interruptor en Ajustes.",
}

export const modelRefusalMessages: Messages<typeof en> = { en, ru, es }
