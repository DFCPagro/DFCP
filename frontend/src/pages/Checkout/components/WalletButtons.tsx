import { memo } from "react";
import { Box, Button, HStack, Icon, Stack, Text } from "@chakra-ui/react";
import { FiSmartphone, FiDollarSign } from "react-icons/fi";

export type WalletButtonsProps = {
    /** Triggered when clicking "Pay with Google Pay" */
    onGooglePay?: () => void;
    /** Triggered when clicking "Pay with PayPal" */
    onPayPal?: () => void;

    /** Disable/enable each provider independently */
    googlePayEnabled?: boolean; // default: true
    paypalEnabled?: boolean; // default: true

    /** Show loading state (e.g., while creating the order) */
    submitting?: boolean;

    /** Layout and messaging */
    fullWidth?: boolean; // default: true (buttons take full width)
    size?: "sm" | "md" | "lg"; // default: "md"
    showNote?: boolean; // default: true
    note?: string; // default demo note
    align?: "stretch" | "start" | "center" | "end"; // default: "stretch"
};

export const WalletButtons = memo(function WalletButtons({
    onGooglePay,
    onPayPal,
    googlePayEnabled = true,
    paypalEnabled = true,
    submitting = false,
    fullWidth = true,
    size = "md",
    showNote = true,
    note = "(Demo) Wallets aren’t wired yet — we’ll place the order as normal.",
    align = "stretch",
}: WalletButtonsProps) {
    return (
        <Stack gap={3} align={align}>
            <HStack gap={3} w={fullWidth ? "100%" : "auto"}>
                <Button
                    onClick={onGooglePay}
                    disabled={!googlePayEnabled}
                    loading={submitting}
                    w={fullWidth ? "100%" : undefined}
                    size={size}
                    variant="subtle"
                    gap={2}
                >
                    <Icon as={FiSmartphone} />
                    Pay with Google&nbsp;Pay
                </Button>

                <Button
                    onClick={onPayPal}
                    disabled={!paypalEnabled}
                    loading={submitting}
                    w={fullWidth ? "100%" : undefined}
                    size={size}
                    variant="subtle"
                    gap={2}
                >
                    <Icon as={FiDollarSign} />
                    Pay with PayPal
                </Button>
            </HStack>

            {showNote && (
                <Box>
                    <Text mt={1} fontSize="sm" color="fg.muted">
                        {note}
                    </Text>
                </Box>
            )}
        </Stack>
    );
});

export default WalletButtons;
