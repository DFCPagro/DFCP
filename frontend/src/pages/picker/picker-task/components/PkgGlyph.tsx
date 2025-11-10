import { Box } from "@chakra-ui/react"
import { Package as PackageIcon } from "lucide-react"

export default function PkgGlyph() {
  return (
    <Box
      w="36px"
      h="36px"
      rounded="md"
      borderWidth="1px"
      bg="bg.subtle"
      _dark={{ bg: "blackAlpha.300" }}
      display="grid"
      placeItems="center"
    >
      <PackageIcon size={18} />
    </Box>
  )
}
