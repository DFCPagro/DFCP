import * as React from "react"
import { Button, HStack, Text } from "@chakra-ui/react"
import { LuCopy, LuCheck } from "react-icons/lu"
import { Tooltip } from "@/components/ui/tooltip"

export function MonoToken({ token, inline = false }: { token: string; inline?: boolean }) {
  const [copied, setCopied] = React.useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(token)
      setCopied(true)
      setTimeout(() => setCopied(false), 1000)
    } catch {}
  }

  return (
    <HStack
      gap="2"
      alignItems="center"
      justifyContent="space-between"
      bg="bg.subtle"
      borderRadius="lg"
      px="3"
      py="2"
      w="full"
      minW="0"
      overflow="hidden"
    >
      <Text
        as="span"
        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
        fontSize={inline ? "xs" : "sm"}
        color="fg.muted"
        lineClamp={1}
        title={token}
        minW="0"
        flex={1}
      >
        {token}
      </Text>

      <Tooltip content={copied ? "Copied!" : "Copy token"}>
        <Button
          size="xs"
          variant="subtle"
          onClick={copy}
          aria-label="Copy QR token"
          flexShrink={0}
        >
          {copied ? <LuCheck /> : <LuCopy />}
        </Button>
      </Tooltip>
    </HStack>
  )
}
