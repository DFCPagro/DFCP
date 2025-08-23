export type Size = "sm" | "md" | "lg";
export type Density = "dots" | "chips";

export type MonthGridProps = {
  year: number;
  month: number;
  days?: number[];
  onDaysChange?: (next: number[]) => void;

  /** Editing turns on tri-state interactions. */
  hideBorder?: boolean
  editable?: boolean;

  /** Visaul surrounded space (Pading body card of table). Default: false  */
  removePadding?: boolean

  /** Visual sizing (padding/font). */
  size?: Size;

  /** Subtle weekend background. Default: true */
  shadeWeekends?: boolean;

  /** Highlight today with a focus ring. Default: true */
  highlightToday?: boolean;

  /** Show totals footer. Default: true */
  showTotals?: boolean;

  /** Show previous/next month date cells. Default: true */
  showAdjacentDays?: boolean;

  /** Density: "dots" (minimal) or "chips" (full). Default: "dots" */
  density?: Density;

  /** Show top “Actions” menu (bulk ops + toggles). Default: editable */
  showActions?: boolean;

  /** Optional weekly template (length 7) for bulk operations. */
  weekdayTemplate?: number[];
};
