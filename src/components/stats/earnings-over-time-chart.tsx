"use client";

import { format } from "date-fns";
import { useMemo } from "react";
import {
  AreaChart,
  CartesianGrid,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
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

type ChartRow = {
  gameId?: string;
  date: number;
  dateLabel: string;
  sessionProfit: number;
  netProfit: number;
};

const chartConfig = {
  netProfit: {
    label: "Net Profit",
    color: "hsl(var(--foreground))",
  },
  sessionProfit: {
    label: "Session",
  },
} satisfies ChartConfig;

export function EarningsOverTimeChart({
  data,
  title = "Earnings Over Time",
  description = "Net profit progression by session date",
}: EarningsOverTimeChartProps) {
  const chartData = useMemo<ChartRow[]>(() => {
    const sorted = [...data].sort((a, b) => a.date - b.date);
    let runningNetProfit = 0;
    return sorted.map((point) => {
      runningNetProfit += point.profit;
      return {
        gameId: point.gameId,
        date: point.date,
        dateLabel: format(new Date(point.date), "MMM d"),
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

  const minNet = Math.min(0, ...chartData.map((d) => d.netProfit));
  const maxNet = Math.max(0, ...chartData.map((d) => d.netProfit));
  const range = Math.max(1, maxNet - minNet);
  const yDomain = [minNet - range * 0.12, maxNet + range * 0.12] as const;
  const latestNetProfit = chartData[chartData.length - 1]?.netProfit ?? 0;
  const chartBackground =
    latestNetProfit >= 0
      ? "linear-gradient(to bottom, hsl(var(--chart-profit-positive) / 0.24), hsl(var(--chart-profit-positive) / 0.12))"
      : "linear-gradient(to bottom, hsl(var(--chart-profit-negative) / 0.24), hsl(var(--chart-profit-negative) / 0.12))";
  const lineColor =
    latestNetProfit >= 0
      ? "hsl(var(--chart-profit-positive))"
      : "hsl(var(--chart-profit-negative))";

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          className="h-[320px] w-full aspect-auto overflow-hidden rounded-md"
          config={chartConfig}
          style={{ background: chartBackground }}
        >
          <AreaChart
            data={chartData}
            margin={{ top: 12, right: 12, bottom: 12, left: 8 }}
          >
            <CartesianGrid strokeDasharray="0" vertical={false} />
            <XAxis
              axisLine={false}
              dataKey="dateLabel"
              minTickGap={24}
              padding={{ left: 20, right: 20 }}
              tickLine={false}
              tickMargin={10}
            />
            <YAxis
              axisLine={false}
              domain={yDomain}
              tickFormatter={(value) => `$${Math.round(value)}`}
              tickLine={false}
              tickMargin={8}
              width={52}
            />
            <ReferenceLine stroke="hsl(var(--muted-foreground) / 0.35)" strokeDasharray="4 4" y={0} />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, name) => {
                    const numericValue = Number(value ?? 0);
                    return (
                      <div className="flex w-full items-center justify-between gap-3">
                        <span className="text-muted-foreground">{name}</span>
                        <span className="font-medium text-foreground">
                          {numericValue >= 0 ? "+" : ""}${numericValue.toFixed(2)}
                        </span>
                      </div>
                    );
                  }}
                  labelFormatter={(_, payload) => {
                    const point = payload?.[0]?.payload as ChartRow | undefined;
                    return point ? format(new Date(point.date), "MMM d, yyyy") : "";
                  }}
                />
              }
              cursor={{ stroke: "hsl(var(--muted-foreground) / 0.25)", strokeDasharray: "3 3" }}
              isAnimationActive={false}
            />
            <Line
              dataKey="sessionProfit"
              activeDot={false}
              dot={false}
              isAnimationActive={false}
              legendType="none"
              stroke="transparent"
              strokeOpacity={0}
              strokeWidth={0}
              type="linear"
            />
            <Line
              activeDot={(dotProps) => (
                <circle
                  cx={dotProps.cx}
                  cy={dotProps.cy}
                  fill={lineColor}
                  r={6}
                  stroke="hsl(var(--background))"
                  strokeWidth={2}
                />
              )}
              dataKey="netProfit"
              dot={false}
              isAnimationActive={false}
              stroke={lineColor}
              strokeWidth={3}
              type="linear"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
