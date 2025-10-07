import { memo, useCallback } from "react";
import { Field, HStack, Input, Stack } from "@chakra-ui/react";

export type CardFormValue = {
    holder: string;
    cardNumber: string; // we keep spaces in UI
    expMonth: string; // "MM"
    expYear: string; // "YYYY"
    cvc: string; // 3-4 digits
};

export type CardFormErrors = Partial<Record<keyof CardFormValue, string>>;

export type CardFormProps = {
    value: CardFormValue;
    onChange: (field: keyof CardFormValue, value: string) => void;
    disabled?: boolean;
    errors?: CardFormErrors;
};

/** keep digits + spaces in UI; strip other chars */
function normalizeCardNumberUI(raw: string): string {
    const digits = raw.replace(/\D+/g, "");
    // group 4-4-4-4 (works fine for Visa/Mastercard; tweak later if you want IIN detection)
    const parts = digits.match(/.{1,4}/g) ?? [];
    return parts.join(" ").slice(0, 19); // 16 digits + 3 spaces
}

function normalizeMonth(raw: string): string {
    const v = raw.replace(/\D+/g, "").slice(0, 2);
    return v;
}

function normalizeYear(raw: string): string {
    return raw.replace(/\D+/g, "").slice(0, 4);
}

function normalizeCvc(raw: string): string {
    return raw.replace(/\D+/g, "").slice(0, 4);
}

export const CardForm = memo(function CardForm({
    value,
    onChange,
    disabled,
    errors,
}: CardFormProps) {
    const onChangeHolder = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => onChange("holder", e.target.value),
        [onChange],
    );

    const onChangeNumber = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) =>
            onChange("cardNumber", normalizeCardNumberUI(e.target.value)),
        [onChange],
    );

    const onChangeMonth = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) =>
            onChange("expMonth", normalizeMonth(e.target.value)),
        [onChange],
    );

    const onChangeYear = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) =>
            onChange("expYear", normalizeYear(e.target.value)),
        [onChange],
    );

    const onChangeCvc = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) =>
            onChange("cvc", normalizeCvc(e.target.value)),
        [onChange],
    );

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
                    placeholder="4242 4242 4242 4242"
                    autoComplete="cc-number"
                    disabled={disabled}
                />
                {errors?.cardNumber && <Field.ErrorText>{errors.cardNumber}</Field.ErrorText>}
            </Field.Root>

            <HStack gap={3}>
                <Field.Root invalid={!!errors?.expMonth}>
                    <Field.Label>Expiry month</Field.Label>
                    <Input
                        value={value.expMonth}
                        onChange={onChangeMonth}
                        inputMode="numeric"
                        placeholder="MM"
                        autoComplete="cc-exp-month"
                        disabled={disabled}
                    />
                    {errors?.expMonth && <Field.ErrorText>{errors.expMonth}</Field.ErrorText>}
                </Field.Root>

                <Field.Root invalid={!!errors?.expYear}>
                    <Field.Label>Expiry year</Field.Label>
                    <Input
                        value={value.expYear}
                        onChange={onChangeYear}
                        inputMode="numeric"
                        placeholder="YYYY"
                        autoComplete="cc-exp-year"
                        disabled={disabled}
                    />
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
                    />
                    {errors?.cvc && <Field.ErrorText>{errors.cvc}</Field.ErrorText>}
                </Field.Root>
            </HStack>
        </Stack>
    );
});

export default CardForm;
