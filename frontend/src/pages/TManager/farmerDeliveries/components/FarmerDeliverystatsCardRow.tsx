import * as React from "react";
import {
  FARMER_DELIVERY_STATUS_COLOR,
  labelOf,
  type StatusKeyFarmerDelivery,
} from "@/components/common/statusPalettes";

import {
  StatCardsRow,
  type StatCardsRowProps,
  type GenericStat,
} from "@/components/common/StatusStatsRow";

export type FarmerDeliveryStat = GenericStat<StatusKeyFarmerDelivery>;

export type FarmerDeliveryStatCardsRowProps = Omit<
  StatCardsRowProps<StatusKeyFarmerDelivery>,
  "colorMap" | "getLabel" | "defaultColorKey"
>;

export function FarmerDeliveryStatCardsRow(props: FarmerDeliveryStatCardsRowProps) {
  return (
    <StatCardsRow<StatusKeyFarmerDelivery>
      {...props}
      colorMap={FARMER_DELIVERY_STATUS_COLOR}
      defaultColorKey="planned"
      getLabel={labelOf}
    />
  );
}
