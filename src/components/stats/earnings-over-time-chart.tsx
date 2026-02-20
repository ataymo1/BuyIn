"use client";

import { format } from "date-fns";
import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface EarningsPoint {
  date: number;
  profit: number;
  gameId?: string;
}

interface EarningsOverTimeChartProps {
  data: EarningsPoint[];
  title?: string;
  description?: string;
}

const CHART_WIDTH = 900;
const CHART_HEIGHT = 320;
const MARGIN = { top: 20, right: 18, bottom: 46, left: 60 };
const X_POINT_PADDING = 28;

export function EarningsOverTimeChart({
  data,
  title = "Earnings Over Time",
  description = "Per-session profit by date",
}: EarningsOverTimeChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const chartData = useMemo(() => {
    const sorted = [...data].sort((a, b) => a.date - b.date);
    let runningNetProfit = 0;
    return sorted.map((point) => {
      runningNetProfit += point.profit;
      return {
        ...point,
        sessionProfit: point.profit,
        netProfit: runningNetProfit,
      };
    });
  }, [data]);

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">No session earnings yet.</p>
        </CardContent>
      </Card>
    );
  }

  const innerWidth = CHART_WIDTH - MARGIN.left - MARGIN.right;
  const innerHeight = CHART_HEIGHT - MARGIN.top - MARGIN.bottom;

  const minProfit = Math.min(0, ...chartData.map((d) => d.netProfit));
  const maxProfit = Math.max(0, ...chartData.map((d) => d.netProfit));
  const range = Math.max(1, maxProfit - minProfit);
  const paddedMin = minProfit - range * 0.12;
  const paddedMax = maxProfit + range * 0.12;

  const x = (index: number) => {
    const xStart = MARGIN.left + X_POINT_PADDING;
    const xWidth = Math.max(1, innerWidth - X_POINT_PADDING * 2);
    return xStart + (chartData.length === 1 ? xWidth / 2 : (index / (chartData.length - 1)) * xWidth);
  };
  const y = (profit: number) =>
    MARGIN.top + ((paddedMax - profit) / Math.max(1, paddedMax - paddedMin)) * innerHeight;

  const points = chartData.map((point, index) => ({
    ...point,
    x: x(index),
    y: y(point.netProfit),
  }));

  const yAxisTicks = [paddedMax, (paddedMax + paddedMin) / 2, paddedMin];
  const zeroY = y(0);
  const hoveredPoint = hoveredIndex !== null ? points[hoveredIndex] : null;
  const isFirstPoint = hoveredIndex === 0;
  const isLastPoint = hoveredIndex === points.length - 1;
  const tooltipX = hoveredPoint ? hoveredPoint.x : null;
  const tooltipY = hoveredPoint ? Math.max(26, hoveredPoint.y - 18) : null;
  const tooltipTransform = isFirstPoint
    ? "translateX(12px)"
    : isLastPoint
      ? "translateX(calc(-100% - 12px))"
      : "translateX(-50%)";

  const segmentPaths: Array<{ x1: number; y1: number; x2: number; y2: number; color: string }> = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];

    if ((a.netProfit >= 0 && b.netProfit >= 0) || (a.netProfit < 0 && b.netProfit < 0)) {
      segmentPaths.push({
        x1: a.x,
        y1: a.y,
        x2: b.x,
        y2: b.y,
        color: a.netProfit >= 0 ? "#16a34a" : "#dc2626",
      });
      continue;
    }

    const profitDelta = b.netProfit - a.netProfit;
    const zeroCrossT = profitDelta === 0 ? 0.5 : (0 - a.netProfit) / profitDelta;
    const crossX = a.x + (b.x - a.x) * zeroCrossT;
    const crossY = y(0);

    segmentPaths.push({
      x1: a.x,
      y1: a.y,
      x2: crossX,
      y2: crossY,
      color: a.netProfit >= 0 ? "#16a34a" : "#dc2626",
    });
    segmentPaths.push({
      x1: crossX,
      y1: crossY,
      x2: b.x,
      y2: b.y,
      color: b.netProfit >= 0 ? "#16a34a" : "#dc2626",
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="relative">
          <svg className="h-[320px] w-full" viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}>
            {yAxisTicks.map((tickValue, index) => (
              <g key={`tick-${index}`}>
                <line
                  stroke="hsl(var(--muted-foreground) / 0.15)"
                  strokeWidth={1}
                  x1={MARGIN.left}
                  x2={CHART_WIDTH - MARGIN.right}
                  y1={y(tickValue)}
                  y2={y(tickValue)}
                />
                <text
                  className="fill-muted-foreground text-xs"
                  textAnchor="end"
                  x={MARGIN.left - 8}
                  y={y(tickValue) + 4}
                >
                  ${tickValue.toFixed(0)}
                </text>
              </g>
            ))}

            <line
              stroke="hsl(var(--muted-foreground) / 0.3)"
              strokeDasharray="4 4"
              strokeWidth={1}
              x1={MARGIN.left}
              x2={CHART_WIDTH - MARGIN.right}
              y1={zeroY}
              y2={zeroY}
            />

            {segmentPaths.map((seg, index) => (
              <line
                key={`seg-${index}`}
                stroke={seg.color}
                strokeLinecap="round"
                strokeWidth={3}
                x1={seg.x1}
                x2={seg.x2}
                y1={seg.y1}
                y2={seg.y2}
              />
            ))}

            {points.map((point, index) => (
              <circle
                key={`pt-${point.gameId ?? index}`}
                cx={point.x}
                cy={point.y}
                fill={point.netProfit >= 0 ? "#16a34a" : "#dc2626"}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
                r={hoveredIndex === index ? 6 : 4}
                style={{ cursor: "pointer" }}
              />
            ))}

            {[0, Math.floor((points.length - 1) / 2), points.length - 1].map((idx) => {
              const point = points[idx];
              return (
                <text
                  className="fill-muted-foreground text-xs"
                  key={`xlabel-${idx}`}
                  textAnchor={idx === 0 ? "start" : idx === points.length - 1 ? "end" : "middle"}
                  x={point.x}
                  y={CHART_HEIGHT - 14}
                >
                  {format(new Date(point.date), "MMM d")}
                </text>
              );
            })}
          </svg>

          {hoveredPoint && (
            <div
              className="pointer-events-none absolute rounded-md border bg-background px-3 py-2 text-xs shadow-lg"
              style={{
                left: `${((tooltipX ?? hoveredPoint.x) / CHART_WIDTH) * 100}%`,
                top: `${((tooltipY ?? hoveredPoint.y) / CHART_HEIGHT) * 100}%`,
                transform: tooltipTransform,
                minWidth: "148px",
                whiteSpace: "nowrap",
              }}
            >
              <p className="font-medium">{format(new Date(hoveredPoint.date), "MMM d, yyyy")}</p>
              <p className={hoveredPoint.netProfit >= 0 ? "text-green-600" : "text-red-600"}>
                Net: {hoveredPoint.netProfit >= 0 ? "+" : ""}${hoveredPoint.netProfit.toFixed(2)}
              </p>
              <p className={hoveredPoint.sessionProfit >= 0 ? "text-green-600" : "text-red-600"}>
                Session: {hoveredPoint.sessionProfit >= 0 ? "+" : ""}${hoveredPoint.sessionProfit.toFixed(2)}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
