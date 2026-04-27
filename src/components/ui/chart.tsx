"use client";

import {
  createContext,
  type ComponentProps,
  type ComponentType,
  type ReactNode,
  forwardRef,
  useContext,
  useId,
} from "react";
import { Legend, ResponsiveContainer, Tooltip } from "recharts";
import { cn } from "@/lib/utils";

const THEMES = { light: "", dark: ".dark" } as const;

export type ChartConfig = Record<
  string,
  {
    label?: ReactNode;
    icon?: ComponentType;
    color?: string;
    theme?: Record<keyof typeof THEMES, string>;
  }
>;

type ChartContextProps = {
  config: ChartConfig;
};

const ChartContext = createContext<ChartContextProps | null>(null);

function useChart() {
  const context = useContext(ChartContext);
  if (!context) {
    throw new Error("useChart must be used within a <ChartContainer />");
  }
  return context;
}

function ChartStyle({
  id,
  config,
}: {
  id: string;
  config: ChartConfig;
}) {
  const colorConfig = Object.entries(config).filter(
    ([, cfg]) => cfg.theme || cfg.color
  );

  if (!colorConfig.length) {
    return null;
  }

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: Object.entries(THEMES)
          .map(
            ([theme, prefix]) => `
${prefix} [data-chart="${id}"] {
${colorConfig
  .map(([key, itemConfig]) => {
    const color =
      itemConfig.theme?.[theme as keyof typeof THEMES] ?? itemConfig.color;
    return color ? `  --color-${key}: ${color};` : null;
  })
  .filter(Boolean)
  .join("\n")}
}
`
          )
          .join("\n"),
      }}
    />
  );
}

export function ChartContainer({
  id,
  className,
  children,
  config,
  ...props
}: ComponentProps<"div"> & {
  config: ChartConfig;
  children: ComponentProps<typeof ResponsiveContainer>["children"];
}) {
  const uniqueId = useId().replace(/:/g, "");
  const chartId = `chart-${id || uniqueId}`;

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        className={cn(
          "flex aspect-video justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-layer]:outline-none [&_.recharts-polar-grid_[stroke='#ccc']]:stroke-border [&_.recharts-radial-bar-background-sector]:fill-muted [&_.recharts-reference-line_[stroke='#ccc']]:stroke-border [&_.recharts-sector[stroke='#fff']]:stroke-transparent [&_.recharts-sector]:outline-none [&_.recharts-surface]:outline-none",
          className
        )}
        data-chart={chartId}
        {...props}
      >
        <ChartStyle config={config} id={chartId} />
        <ResponsiveContainer>{children}</ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
}

export const ChartTooltip = Tooltip;
export const ChartLegend = Legend;

type TooltipPayloadItem = {
  dataKey?: string | number;
  name?: string;
  value?: number | string;
  color?: string;
  payload?: Record<string, unknown>;
};

export const ChartTooltipContent = forwardRef<
  HTMLDivElement,
  {
    className?: string;
    active?: boolean;
    payload?: TooltipPayloadItem[];
    label?: string | number;
    hideLabel?: boolean;
    hideIndicator?: boolean;
    labelFormatter?: (label: unknown, payload?: TooltipPayloadItem[]) => ReactNode;
    formatter?: (
      value: unknown,
      name: string,
      item: TooltipPayloadItem,
      index: number,
      payload: TooltipPayloadItem[]
    ) => ReactNode;
  }
>(function ChartTooltipContent(
  {
    className,
    active,
    payload,
    label,
    hideLabel = false,
    hideIndicator = false,
    labelFormatter,
    formatter,
  },
  ref
) {
  const { config } = useChart();

  if (!active || !payload?.length) {
    return null;
  }

  const renderedLabel = hideLabel
    ? null
    : labelFormatter
      ? labelFormatter(label, payload)
      : label;

  return (
    <div
      className={cn(
        "grid min-w-[10rem] items-start gap-1.5 rounded-lg border border-border/50 bg-background px-3 py-2 text-xs shadow-xl",
        className
      )}
      ref={ref}
    >
      {renderedLabel ? (
        <div className="font-medium text-foreground">{renderedLabel}</div>
      ) : null}
      <div className="grid gap-1">
        {payload.map((item, index) => {
          const key = String(item.dataKey ?? item.name ?? index);
          const configItem = config[key];
          const itemName = String(configItem?.label ?? item.name ?? key);

          if (formatter) {
            const formatted = formatter(item.value, itemName, item, index, payload);
            if (formatted == null) {
              return null;
            }
            return <div key={`${key}-${index}`}>{formatted}</div>;
          }

          return (
            <div
              className="flex w-full items-center justify-between gap-2"
              key={`${key}-${index}`}
            >
              <div className="flex items-center gap-2">
                {!hideIndicator ? (
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                    style={{
                      backgroundColor:
                        item.color ?? `var(--color-${String(item.dataKey ?? "")})`,
                    }}
                  />
                ) : null}
                <span className="text-muted-foreground">{itemName}</span>
              </div>
              <span className="font-mono font-medium text-foreground">
                {typeof item.value === "number"
                  ? item.value.toLocaleString()
                  : item.value}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
});
ChartTooltipContent.displayName = "ChartTooltipContent";

export const ChartLegendContent = forwardRef<
  HTMLDivElement,
  ComponentProps<"div"> & {
    payload?: Array<{ dataKey?: string; color?: string; value?: string }>;
    hideIcon?: boolean;
  }
>(function ChartLegendContent(
  { className, payload, hideIcon = false, ...props },
  ref
) {
  const { config } = useChart();

  if (!payload?.length) {
    return null;
  }

  return (
    <div
      className={cn("flex items-center justify-center gap-4 pt-3", className)}
      ref={ref}
      {...props}
    >
      {payload.map((item, index) => {
        const key = item.dataKey ?? `legend-${index}`;
        const configItem = config[key];
        return (
          <div className="flex items-center gap-1.5" key={`${key}-${index}`}>
            {!hideIcon ? (
              <span
                className="h-2.5 w-2.5 rounded-[2px]"
                style={{ backgroundColor: item.color ?? `var(--color-${key})` }}
              />
            ) : null}
            <span className="text-muted-foreground text-xs">
              {configItem?.label ?? item.value ?? key}
            </span>
          </div>
        );
      })}
    </div>
  );
});
ChartLegendContent.displayName = "ChartLegendContent";
