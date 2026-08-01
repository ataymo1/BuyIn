"use client";

import { format } from "date-fns";
import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
} from "@/components/ui/chart";

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

interface ChartRow {
  gameId?: string;
  date: number;
  dateLabel: string;
  sessionProfit: number;
  netProfit: number;
  positiveNetProfit: number | null;
  negativeNetProfit: number | null;
  isSynthetic?: boolean;
}

interface EarningsTooltipProps {
  active?: boolean;
  payload?: Array<{ payload?: ChartRow }>;
}

const chartConfig = {
  netProfit: {
    label: "Net Profit",
    color: "hsl(var(--foreground))",
  },
} satisfies ChartConfig;

function formatCurrency(value: number) {
  return `${value >= 0 ? "+" : ""}$${value.toFixed(2)}`;
}

function EarningsTooltip({ active, payload }: EarningsTooltipProps) {
  const point = payload?.find((entry) => entry.payload)?.payload;

  if (!(active && point) || point.isSynthetic) {
    return null;
  }

  return (
    <div className="grid min-w-[10rem] gap-1.5 rounded-lg border border-border/60 bg-background/95 px-3 py-2 text-xs shadow-2xl backdrop-blur">
      <div className="font-medium text-foreground">
        {format(new Date(point.date), "MMM d, yyyy")}
      </div>
      <div className="grid gap-1">
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Net Profit</span>
          <span className="font-medium text-foreground">
            {formatCurrency(point.netProfit)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Session</span>
          <span className="font-medium text-foreground">
            {formatCurrency(point.sessionProfit)}
          </span>
        </div>
      </div>
    </div>
  );
}

function getNiceStep(value: number) {
  if (value <= 0) {
    return 1;
  }

  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;

  if (normalized <= 1) {
    return magnitude;
  }
  if (normalized <= 2) {
    return 2 * magnitude;
  }
  if (normalized <= 2.5) {
    return 2.5 * magnitude;
  }
  if (normalized <= 5) {
    return 5 * magnitude;
  }

  return 10 * magnitude;
}

export function EarningsOverTimeChart({
  data,
  title = "Earnings Over Time",
  description = "Net profit progression by session date",
}: EarningsOverTimeChartProps) {
  const chartData = useMemo<ChartRow[]>(() => {
    const sorted = [...data].sort((a, b) => a.date - b.date);
    let runningNetProfit = 0;
    const points = sorted.map((point) => {
      runningNetProfit += point.profit;
      return {
        gameId: point.gameId,
        date: point.date,
        dateLabel: format(new Date(point.date), "MMM d"),
        sessionProfit: point.profit,
        netProfit: runningNetProfit,
        positiveNetProfit: runningNetProfit >= 0 ? runningNetProfit : null,
        negativeNetProfit: runningNetProfit <= 0 ? runningNetProfit : null,
      };
    });

    if (points.length <= 1) {
      return points;
    }

    const rows: ChartRow[] = [];

    for (let index = 0; index < points.length; index += 1) {
      const current = points[index];
      const next = points[index + 1];

      rows.push(current);

      if (!next) {
        continue;
      }

      if (
        current.netProfit !== 0 &&
        next.netProfit !== 0 &&
        Math.sign(current.netProfit) !== Math.sign(next.netProfit)
      ) {
        const distanceToZero = Math.abs(current.netProfit);
        const totalDistance = Math.abs(current.netProfit - next.netProfit);
        const ratio = totalDistance === 0 ? 0 : distanceToZero / totalDistance;
        const crossingDate = current.date + (next.date - current.date) * ratio;

        rows.push({
          date: crossingDate,
          dateLabel: format(new Date(crossingDate), "MMM d"),
          sessionProfit: 0,
          netProfit: 0,
          positiveNetProfit: 0,
          negativeNetProfit: 0,
          isSynthetic: true,
        });
      }
    }

    return rows;
  }, [data]);

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            No session earnings yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  const peakMagnitude = Math.max(
    1,
    ...chartData.map((d) => Math.abs(d.netProfit))
  );
  const targetOuterTick = peakMagnitude / 2;
  const tickStep = getNiceStep(targetOuterTick);
  const yTicks = [-2 * tickStep, -tickStep, 0, tickStep, 2 * tickStep];
  const yDomain = [yTicks[0] ?? 0, yTicks.at(-1) ?? 0] as const;
  const latestNetProfit = chartData.at(-1)?.netProfit ?? 0;
  const positiveLineColor = "hsl(var(--chart-profit-positive))";
  const negativeLineColor = "hsl(var(--chart-profit-negative))";

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          className="aspect-auto h-[320px] w-full overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-b from-muted/40 via-background to-background px-2 pt-3 shadow-sm"
          config={chartConfig}
        >
          <AreaChart
            data={chartData}
            margin={{ top: 14, right: 16, bottom: 8, left: 2 }}
          >
            <defs>
              <linearGradient
                id="earningsPositiveFill"
                x1="0"
                x2="0"
                y1="0"
                y2="1"
              >
                <stop
                  offset="0%"
                  stopColor="hsl(var(--chart-profit-positive) / 0.24)"
                />
                <stop
                  offset="100%"
                  stopColor="hsl(var(--chart-profit-positive) / 0.02)"
                />
              </linearGradient>
              <linearGradient
                id="earningsNegativeFill"
                x1="0"
                x2="0"
                y1="0"
                y2="1"
              >
                <stop
                  offset="0%"
                  stopColor="hsl(var(--chart-profit-negative) / 0.02)"
                />
                <stop
                  offset="100%"
                  stopColor="hsl(var(--chart-profit-negative) / 0.24)"
                />
              </linearGradient>
            </defs>
            <CartesianGrid
              stroke="hsl(var(--border) / 0.35)"
              strokeDasharray="3 6"
              vertical={false}
            />
            <XAxis
              axisLine={false}
              dataKey="dateLabel"
              minTickGap={24}
              padding={{ left: 12, right: 12 }}
              tickLine={false}
              tickMargin={12}
            />
            <YAxis
              axisLine={false}
              domain={yDomain}
              tickFormatter={(value) =>
                `${value < 0 ? "-" : ""}$${Math.abs(Math.round(value))}`
              }
              tickLine={false}
              tickMargin={10}
              ticks={yTicks}
              width={64}
            />
            <ReferenceLine
              stroke="hsl(var(--muted-foreground) / 0.28)"
              strokeDasharray="4 6"
              y={0}
            />
            <ChartTooltip
              content={<EarningsTooltip />}
              cursor={{
                stroke: "hsl(var(--muted-foreground) / 0.25)",
                strokeDasharray: "3 3",
              }}
              isAnimationActive={false}
            />
            <Area
              dataKey="positiveNetProfit"
              fill="url(#earningsPositiveFill)"
              isAnimationActive={false}
              name="Net Profit"
              stroke="none"
              type="monotone"
            />
            <Area
              dataKey="negativeNetProfit"
              fill="url(#earningsNegativeFill)"
              isAnimationActive={false}
              name="Net Profit"
              stroke="none"
              type="monotone"
            />
            <Line
              activeDot={(dotProps) =>
                (dotProps.payload as ChartRow).isSynthetic ? (
                  <g />
                ) : (
                  <circle
                    cx={dotProps.cx}
                    cy={dotProps.cy}
                    fill={
                      latestNetProfit >= 0
                        ? positiveLineColor
                        : negativeLineColor
                    }
                    r={5}
                    stroke="hsl(var(--background))"
                    strokeWidth={2.5}
                  />
                )
              }
              dataKey="positiveNetProfit"
              dot={false}
              isAnimationActive={false}
              name="Net Profit"
              stroke={positiveLineColor}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={3.25}
              type="monotone"
            />
            <Line
              activeDot={(dotProps) =>
                (dotProps.payload as ChartRow).isSynthetic ? (
                  <g />
                ) : (
                  <circle
                    cx={dotProps.cx}
                    cy={dotProps.cy}
                    fill={
                      latestNetProfit >= 0
                        ? positiveLineColor
                        : negativeLineColor
                    }
                    r={5}
                    stroke="hsl(var(--background))"
                    strokeWidth={2.5}
                  />
                )
              }
              dataKey="negativeNetProfit"
              dot={false}
              isAnimationActive={false}
              name="Net Profit"
              stroke={negativeLineColor}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={3.25}
              type="monotone"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
