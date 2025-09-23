import { memo, useMemo } from "react";

export type SparklineProps = {
  /** Sequence of values to plot (left → right). Empty array renders nothing. */
  data: number[];

  /** Overall size (px). */
  width?: number;
  height?: number;

  /** Visual styling */
  stroke?: string;       // line color
  strokeWidth?: number;  // line width
  fill?: string;         // area fill color (set to "none" to disable)
  fillOpacity?: number;  // 0..1 for area fill

  /** Add a small dot at the last point */
  showLastDot?: boolean;
  dotRadius?: number;
  dotColor?: string;

  /** Add an accessible title/desc for screen readers */
  title?: string;
  desc?: string;

  /** Padding inside the SVG bounds (px) */
  padding?: number;

  /** Optional y-domain override; otherwise computed from data (min/max). */
  min?: number;
  max?: number;

  /** Round the path joins/caps for nicer look */
  rounded?: boolean;
};

/**
 * Minimal, robust sparkline:
 * - Pure SVG path; no external dependencies.
 * - Auto scales to provided width/height with optional padding.
 * - If all values are equal, draws a flat line centered vertically.
 */
function SparklineBase({
  data,
  width = 160,
  height = 48,
  stroke = "currentColor",
  strokeWidth = 2,
  fill = "none",
  fillOpacity = 0.15,
  showLastDot = true,
  dotRadius = 2.5,
  dotColor,
  title,
  desc,
  padding = 4,
  min,
  max,
  rounded = true,
}: SparklineProps) {
  const { pathD, areaD, xLast, yLast } = useMemo(() => {
    const n = data.length;
    const w = Math.max(1, width);
    const h = Math.max(1, height);
    const pad = Math.max(0, padding);

    if (!n) {
      return { pathD: "", areaD: "", xLast: 0, yLast: 0 };
    }

    const x0 = pad;
    const x1 = w - pad;
    const y0 = pad;
    const y1 = h - pad;

    const dMin = min ?? Math.min(...data);
    const dMax = max ?? Math.max(...data);
    const same = dMax - dMin === 0;

    const xFor = (i: number) =>
      n === 1 ? (x0 + x1) / 2 : x0 + (i * (x1 - x0)) / (n - 1);
    const yFor = (v: number) =>
      same ? (y0 + y1) / 2 : y1 - ((v - dMin) * (y1 - y0)) / (dMax - dMin);

    // Build a simple "M x,y L ..." path (straight segments for robustness)
    let d = `M ${xFor(0)},${yFor(data[0])}`;
    for (let i = 1; i < n; i++) {
      d += ` L ${xFor(i)},${yFor(data[i])}`;
    }

    // Optional area path from baseline (y1)
    let a = "";
    if (fill !== "none") {
      a = `M ${xFor(0)},${y1} L ${xFor(0)},${yFor(data[0])}`;
      for (let i = 1; i < n; i++) {
        a += ` L ${xFor(i)},${yFor(data[i])}`;
      }
      a += ` L ${xFor(n - 1)},${y1} Z`;
    }

    return {
      pathD: d,
      areaD: a,
      xLast: xFor(n - 1),
      yLast: yFor(data[n - 1]),
    };
  }, [data, width, height, padding, min, max, fill]);

  if (!data.length) {
    // Render an empty box to keep layout stable
    return <svg width={width} height={height} role="img" aria-label={title || "sparkline"} />;
  }

  const strokeLinecap = rounded ? "round" : "butt";
  const strokeLinejoin = rounded ? "round" : "miter";

  return (
    <svg
      width={width}
      height={height}
      role="img"
      aria-label={title}
      viewBox={`0 0 ${width} ${height}`}
    >
      {title ? <title>{title}</title> : null}
      {desc ? <desc>{desc}</desc> : null}

      {fill !== "none" && areaD ? (
        <path d={areaD} fill={fill} fillOpacity={fillOpacity} />
      ) : null}

      <path
        d={pathD}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap={strokeLinecap}
        strokeLinejoin={strokeLinejoin}
      />

      {showLastDot ? (
        <circle
          cx={xLast}
          cy={yLast}
          r={dotRadius}
          fill={dotColor || stroke}
          stroke="none"
        />
      ) : null}
    </svg>
  );
}

export const Sparkline = memo(SparklineBase);
export default Sparkline;
