import { type ReactNode, useId } from "react"
import { useMessages } from "@/i18n"
import { errorText } from "@/shared/errors"
import { modelRefusalMessages, modelRefusalOf } from "@/shared/messages-model-refusals"
import { Collapse } from "@/ui/Collapse"
import { fieldClass } from "@/ui/field"

type Props = {
  model: string
  onModel: (model: string) => void
  modelLabel: ReactNode
  modelHelp: string
  address: string
  onAddress: (address: string) => void
  addressLabel: string
  addressHelp: string
  /** The address field shows only where an address applies (OpenAI-compatible APIs). */
  withAddress: boolean
  disabled: boolean
}

/** A hosted model by name, and the address of the API that serves it: search harder's and search rewriting's form. */
export function ModelAddressFields(props: Props) {
  const { model, onModel, modelLabel, modelHelp, address, onAddress, addressLabel, addressHelp } = props
  const modelId = useId()
  const modelHelpId = useId()
  const addressId = useId()
  const addressHelpId = useId()
  return (
    <>
      <div className="flex flex-col gap-1">
        <label htmlFor={modelId} className="text-[0.9rem] font-medium text-ink">
          {modelLabel}
        </label>
        <input
          id={modelId}
          className={`${fieldClass} max-w-[24rem] font-mono`}
          value={model}
          disabled={props.disabled}
          spellCheck={false}
          autoComplete="off"
          aria-describedby={modelHelpId}
          onChange={(e) => onModel(e.target.value)}
        />
        <p id={modelHelpId} className="text-[0.8rem] text-ink-dim">
          {modelHelp}
        </p>
      </div>
      <Collapse open={props.withAddress}>
        <div className="flex flex-col gap-1">
          <label htmlFor={addressId} className="text-[0.9rem] font-medium text-ink">
            {addressLabel}
          </label>
          <input
            id={addressId}
            type="url"
            className={`${fieldClass} max-w-[28rem] font-mono`}
            value={address}
            disabled={props.disabled}
            spellCheck={false}
            autoComplete="off"
            aria-describedby={addressHelpId}
            onChange={(e) => onAddress(e.target.value)}
          />
          <p id={addressHelpId} className="text-[0.8rem] text-ink-dim">
            {addressHelp}
          </p>
        </div>
      </Collapse>
    </>
  )
}

/** memo's refusal of a model's address in the window's words, or `null` for any other failure. */
export function useRefusalText() {
  const said = useMessages(modelRefusalMessages)
  return (e: unknown) => {
    const refusal = modelRefusalOf(errorText(e))
    return refusal ? said[refusal] : null
  }
}
