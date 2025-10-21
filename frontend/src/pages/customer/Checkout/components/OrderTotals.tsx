import { memo } from "react";
import { Card, HStack, Separator, Stack, Text } from "@chakra-ui/react";

export type OrderTotalsProps = {
    /** Subtotal of all items (estimated, pre-tax/fees) */
    itemsSubtotal: number;
    /** Delivery fee (0 if server computes later) */
    deliveryFee: number;
    /** Tax in the same currency */
    taxUsd: number;
    /** Grand total */
    totalPrice: number;

    /** Currency code for formatting (defaults to USD) */
    currency?: string;

    /**
     * Render style:
     *  - "card": wraps in a Card with header
     *  - "plain": just the rows stack (parent provides container)
     */
    variant?: "card" | "plain";

    /** Header title when variant="card" (defaults to "Totals") */
    title?: string;

    /** Make the Total line bolder/larger */
    emphasizeTotal?: boolean;

    /** How to align label/value pairs */
    rowJustify?: "space-between" | "end" | "start";
};

function formatCurrency(n: number | null | undefined, currency = "USD") {
    const v = Number(n ?? 0);
    const safe = Number.isFinite(v) ? v : 0;
    return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
    }).format(safe);
}

function TotalsRows({
    itemsSubtotal,
    deliveryFee,
    taxUsd,
    totalPrice,
    currency = "USD",
    emphasizeTotal = true,
    rowJustify = "space-between",
}: Required<
    Pick<
        OrderTotalsProps,
        | "itemsSubtotal"
        | "deliveryFee"
        | "taxUsd"
        | "totalPrice"
        | "currency"
        | "emphasizeTotal"
        | "rowJustify"
    >
>) {
    return (
        <Stack gap={2}>
            <HStack justifyContent={rowJustify}>
                <Text color="fg.muted">Items subtotal</Text>
                <Text>{formatCurrency(itemsSubtotal, currency)}</Text>
            </HStack>

            <HStack justifyContent={rowJustify}>
                <Text color="fg.muted">Delivery fee</Text>
                <Text>{formatCurrency(deliveryFee, currency)}</Text>
            </HStack>

            <HStack justifyContent={rowJustify}>
                <Text color="fg.muted">Tax</Text>
                <Text>{formatCurrency(taxUsd, currency)}</Text>
            </HStack>

            <Separator />

            <HStack justifyContent={rowJustify}>
                <Text fontWeight={emphasizeTotal ? "semibold" : "medium"}>Total</Text>
                <Text fontWeight={emphasizeTotal ? "semibold" : "medium"}>
                    {formatCurrency(totalPrice, currency)}
                </Text>
            </HStack>
        </Stack>
    );
}

export const OrderTotals = memo(function OrderTotals({
    itemsSubtotal,
    deliveryFee,
    taxUsd,
    totalPrice,
    currency = "USD",
    variant = "card",
    title = "Totals",
    emphasizeTotal = true,
    rowJustify = "space-between",
}: OrderTotalsProps) {
    if (variant === "plain") {
        return (
            <TotalsRows
                itemsSubtotal={itemsSubtotal}
                deliveryFee={deliveryFee}
                taxUsd={taxUsd}
                totalPrice={totalPrice}
                currency={currency}
                emphasizeTotal={emphasizeTotal}
                rowJustify={rowJustify}
            />
        );
    }

    return (
        <Card.Root>
            <Card.Header pb={2}>
                <Text fontWeight="semibold">{title}</Text>
            </Card.Header>
            <Card.Body pt={0}>
                <TotalsRows
                    itemsSubtotal={itemsSubtotal}
                    deliveryFee={deliveryFee}
                    taxUsd={taxUsd}
                    totalPrice={totalPrice}
                    currency={currency}
                    emphasizeTotal={emphasizeTotal}
                    rowJustify={rowJustify}
                />
            </Card.Body>
        </Card.Root>
    );
});

export default OrderTotals;
