import type React from "react"
import { memo, useCallback, useMemo } from "react"
import { Field, HStack, Input, NativeSelect, Stack } from "@chakra-ui/react"

export type CardFormValue = {
    holder: string
    cardNumber: string // UI formatted with " - " separators
    expMonth: string // "MM"
    expYear: string // "YY"
    cvc: string // 3-4 digits
}

export type CardFormErrors = Partial<Record<keyof CardFormValue, string>>

export type CardFormProps = {
    value: CardFormValue
    onChange: (field: keyof CardFormValue, value: string) => void
    disabled?: boolean
    errors?: CardFormErrors
}

/** keep digits; format UI as '1234 - 1234 - 1234 - 1234' */
function normalizeCardNumberUI(raw: string): string {
    const digits = raw.replace(/\D+/g, "")
    const parts = digits.match(/.{1,4}/g) ?? []
    // Each separator is " - " (3 chars). Max total length: 16 + (3 * 3) = 25
    return parts.join(" - ").slice(0, 25)
}

function normalizeMonth(raw: string): string {
    const v = raw.replace(/\D+/g, "").slice(0, 2)
    return v
}

function normalizeYear(raw: string): string {
    return raw.replace(/\D+/g, "").slice(0, 2)
}

function normalizeCvc(raw: string): string {
    return raw.replace(/\D+/g, "").slice(0, 4)
}

// --- helpers for dropdowns & “current” window ---
const now = new Date()
const CURRENT_YEAR_FULL = now.getFullYear() // e.g., 2025
const CURRENT_YY = String(CURRENT_YEAR_FULL % 100).padStart(2, "0") // "25"
const CURRENT_MM = String(now.getMonth() + 1).padStart(2, "0") // "05" for May

const MAX_YEAR_FULL = CURRENT_YEAR_FULL + 20

function buildMonthOptions() {
    // "01" .. "12"
    return Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"))
}

function buildYearOptionsYY() {
    // ["25", "26", ..., "45"] if current is 2025
    const years: string[] = []
    for (let y = CURRENT_YEAR_FULL; y <= MAX_YEAR_FULL; y++) {
        years.push(String(y % 100).padStart(2, "0"))
    }
    return years
}

export const CardForm = memo(function CardForm({
    value,
    onChange,
    disabled,
    errors,
}: CardFormProps) {
    const monthOptions = useMemo(() => buildMonthOptions(), [])
    const yearOptions = useMemo(() => buildYearOptionsYY(), [])

    const onChangeHolder = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => onChange("holder", e.target.value),
        [onChange],
    )

    const onChangeNumber = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) =>
            onChange("cardNumber", normalizeCardNumberUI(e.target.value)),
        [onChange],
    )

    const onChangeMonth = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => onChange("expMonth", normalizeMonth(e.target.value)),
        [onChange],
    )

    const onChangeYear = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => onChange("expYear", normalizeYear(e.target.value)),
        [onChange],
    )

    const onChangeCvc = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => onChange("cvc", normalizeCvc(e.target.value)),
        [onChange],
    )

    return (
        <Stack gap={3}>
            <Field.Root invalid={!!errors?.holder}>
                <Field.Label>Cardholder name</Field.Label>
                <Input
                    value={value.holder}
                    onChange={onChangeHolder}
                    placeholder="Full name on card"
                    autoComplete="cc-name"
                    disabled={disabled}
                />
                {errors?.holder && <Field.ErrorText>{errors.holder}</Field.ErrorText>}
            </Field.Root>

            <Field.Root invalid={!!errors?.cardNumber}>
                <Field.Label>Card number</Field.Label>
                <Input
                    value={value.cardNumber}
                    onChange={onChangeNumber}
                    inputMode="numeric"
                    placeholder="1234 - 1234 - 1234 - 1234"
                    autoComplete="cc-number"
                    disabled={disabled}
                    maxLength={25} // 16 digits + 3 separators of " - "
                />
                {errors?.cardNumber && <Field.ErrorText>{errors.cardNumber}</Field.ErrorText>}
            </Field.Root>

            <HStack gap={3}>
                <Field.Root invalid={!!errors?.expMonth}>
                    <Field.Label>Expiry month</Field.Label>
                    <NativeSelect.Root disabled={!!disabled}>
                        <NativeSelect.Field
                            value={value.expMonth}
                            onChange={(e) => onChange("expMonth", e.target.value)}
                        >
                            <option value="" disabled>
                                MM
                            </option>
                            {monthOptions.map((mm) => {
                                const disablePast = value.expYear === CURRENT_YY && mm < CURRENT_MM
                                return (
                                    <option key={mm} value={mm} disabled={disablePast}>
                                        {mm}
                                    </option>
                                )
                            })}
                        </NativeSelect.Field>
                        <NativeSelect.Indicator />
                    </NativeSelect.Root>
                    {errors?.expMonth && <Field.ErrorText>{errors.expMonth}</Field.ErrorText>}
                </Field.Root>

                <Field.Root invalid={!!errors?.expYear}>
                    <Field.Label>Expiry year</Field.Label>
                    <NativeSelect.Root disabled={!!disabled}>
                        <NativeSelect.Field
                            value={value.expYear}
                            onChange={(e) => {
                                const nextYY = e.target.value
                                onChange("expYear", nextYY)

                                // If switching to current year while month is set and in the past,
                                // gently bump month to current month to keep combo valid.
                                if (nextYY === CURRENT_YY && value.expMonth && value.expMonth < CURRENT_MM) {
                                    onChange("expMonth", CURRENT_MM)
                                }
                            }}
                        >
                            <option value="" disabled>
                                YY
                            </option>
                            {yearOptions.map((yy) => (
                                <option key={yy} value={yy}>
                                    {yy}
                                </option>
                            ))}
                        </NativeSelect.Field>
                        <NativeSelect.Indicator />
                    </NativeSelect.Root>
                    {errors?.expYear && <Field.ErrorText>{errors.expYear}</Field.ErrorText>}
                </Field.Root>

                <Field.Root invalid={!!errors?.cvc}>
                    <Field.Label>CVC</Field.Label>
                    <Input
                        value={value.cvc}
                        onChange={onChangeCvc}
                        inputMode="numeric"
                        placeholder="CVC"
                        autoComplete="cc-csc"
                        disabled={disabled}
                        maxLength={4}
                    />
                    {errors?.cvc && <Field.ErrorText>{errors.cvc}</Field.ErrorText>}
                </Field.Root>
            </HStack>
        </Stack>
    )
})

export default CardForm
