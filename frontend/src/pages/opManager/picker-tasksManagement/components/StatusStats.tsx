import * as React from "react";
import {
  STATUS_BASE_COLOR,
  labelOf,
  type StatusKeyPickerTask,
} from "@/components/common/statusPalettes";
import {
  StatCardsRow,
  type StatCardsRowProps,
  type GenericStat,
} from "@/components/common/StatusStatsRow";

export type PickerStat = GenericStat<StatusKeyPickerTask>;

export type PickerStatCardsRowProps = Omit<
  StatCardsRowProps<StatusKeyPickerTask>,
  "colorMap" | "getLabel" | "defaultColorKey"
>;

export function PickerStatCardsRow(props: PickerStatCardsRowProps) {
  return (
    <StatCardsRow<StatusKeyPickerTask>
      {...props}
      colorMap={STATUS_BASE_COLOR}
      defaultColorKey="open"
      getLabel={labelOf}
    />
  );
}
