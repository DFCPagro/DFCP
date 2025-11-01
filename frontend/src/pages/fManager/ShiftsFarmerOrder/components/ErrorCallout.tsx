import { memo } from "react"
import { Alert, Button } from "@chakra-ui/react"
import { FiRefreshCcw } from "react-icons/fi"

export type ErrorCalloutProps = {
    /** Headline for the error */
    title: string
    /** Optional longer description or error.message */
    description?: string
    /** Called when the user clicks "Retry" (button hidden if not provided) */
    onRetry?: () => void
    /** Customize the retry button label */
    retryLabel?: string
    /** If true, reduces vertical padding */
    compact?: boolean
}

export const ErrorCallout = memo(function ErrorCallout({
    title,
    description,
    onRetry,
    retryLabel = "Retry",
    compact = false,
}: ErrorCalloutProps) {
    return (
        <Alert.Root
            status="error"
            variant="surface"
            borderRadius="md"
            borderWidth="1px"
            borderColor="border"
            py={compact ? "2" : "3"}
            px="3"
            alignItems="start"
            gap="3"
        >
            <Alert.Indicator />
            <Alert.Content flex="1">
                <Alert.Title>{title}</Alert.Title>
                {description ? (
                    <Alert.Description mt="1">{description}</Alert.Description>
                ) : null}
            </Alert.Content>

            {onRetry ? (
                <Button onClick={onRetry} size="sm" variant="solid">
                    <FiRefreshCcw aria-hidden />
                    <span style={{ marginInlineStart: "0.5rem" }}>{retryLabel}</span>
                </Button>
            ) : null}
        </Alert.Root>
    )
})
