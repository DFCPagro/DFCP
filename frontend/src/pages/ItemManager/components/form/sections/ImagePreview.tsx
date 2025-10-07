import { Badge, Box, Card, HStack, Image, Spinner, Stack, Text } from "@chakra-ui/react"
import * as React from "react"

type PreviewStatus = "idle" | "loading" | "success" | "error"

function useImageStatus(src?: string | null) {
  const [status, setStatus] = React.useState<PreviewStatus>("idle")
  const [resolved, setResolved] = React.useState<string | undefined>(undefined)

  React.useEffect(() => {
    const url = (src ?? "").trim()
    if (!url) {
      setStatus("idle")
      setResolved(undefined)
      return
    }
    let cancelled = false
    setStatus("loading")

    const img = new window.Image()
    img.onload = () => {
      if (!cancelled) {
        setStatus("success")
        setResolved(url)
      }
    }
    img.onerror = () => {
      if (!cancelled) {
        setStatus("error")
        setResolved(undefined)
      }
    }
    img.src = url

    return () => {
      cancelled = true
    }
  }, [src])

  return { status, src: resolved }
}

export default function ImagePreview({ src }: { src?: string | null }) {
  const { status, src: okSrc } = useImageStatus(src)

  return (
    <Card.Root overflow="hidden" variant="elevated">
      <Box position="relative" bg="blackAlpha.50">
        {status === "success" && (
          <Image
            src={okSrc}
            alt="Item preview"
            w="full"
            h="220px"
            objectFit="cover"
          />
        )}

        {status === "idle" && (
          <Box
            w="full"
            h="220px"
            display="flex"
            alignItems="center"
            justifyContent="center"
            color="fg.muted"
          >
            <Stack align="center" gap="1">
              <Text fontWeight="medium">Image preview</Text>
              <Text fontSize="xs">Enter a valid image URL to preview</Text>
            </Stack>
          </Box>
        )}

        {status === "loading" && (
          <Box
            w="full"
            h="220px"
            display="flex"
            alignItems="center"
            justifyContent="center"
          >
            <Spinner />
          </Box>
        )}

        {status === "error" && (
          <Box
            w="full"
            h="220px"
            display="flex"
            alignItems="center"
            justifyContent="center"
            textAlign="center"
            px="4"
          >
            <Stack align="center" gap="1">
              <Text fontWeight="medium">Couldn’t load image</Text>
              <Text fontSize="xs" color="fg.muted">
                Check the URL or try another image.
              </Text>
            </Stack>
          </Box>
        )}
      </Box>

      <Card.Footer justifyContent="space-between">
        <HStack gap="2">
          <Badge variant="outline">Live</Badge>
          <Text fontSize="sm" color="fg.muted">
            Updates as you type
          </Text>
        </HStack>
      </Card.Footer>
    </Card.Root>
  )
}
