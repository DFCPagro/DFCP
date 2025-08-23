import { HStack, Button } from "@chakra-ui/react";
import { Tooltip } from "@/components/ui/tooltip";
import { ACTIVE_COLOR } from "../constants";

export default function StepsNav({
  stepIdx,
  setStepIdx,
  onSave,
}: {
  stepIdx: number;
  setStepIdx: (n: number) => void;
  onSave: () => void;
}) {
  const isStep1 = stepIdx === 0;
  const isStep2 = stepIdx === 1;

  return (
    <HStack>
      <Button
        variant="outline"
        onClick={() => setStepIdx(Math.max(0, stepIdx - 1))}
        disabled={stepIdx === 0}
      >
        Back
      </Button>

      {isStep1 && (
        <Button colorPalette={ACTIVE_COLOR} onClick={() => setStepIdx(1)}>
          Next
        </Button>
      )}

      {isStep2 && (
        <Tooltip content="You can save now. (Limits are enforced while editing.)">
          <Button colorPalette={ACTIVE_COLOR} onClick={onSave}>
            Save
          </Button>
        </Tooltip>
      )}
    </HStack>
  );
}
