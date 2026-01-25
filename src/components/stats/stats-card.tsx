import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface StatsCardProps {
  title: string;
  description?: string;
  value: string | number;
  icon?: ReactNode;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  valueColorMode?: "profit" | "none";
  numericValue?: number;
}

function getValueColorClass(mode: "profit" | "none" | undefined, numericValue: number | undefined): string {
  if (mode !== "profit" || numericValue === undefined) return "";
  if (numericValue > 0) return "text-green-600";
  if (numericValue < 0) return "text-red-600";
  return "";
}

export function StatsCard({
  title,
  description,
  value,
  icon,
  trend,
  valueColorMode,
  numericValue,
}: StatsCardProps) {
  const valueColorClass = getValueColorClass(valueColorMode, numericValue);
  
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="font-medium text-sm">{title}</CardTitle>
        {icon && <div className="h-4 w-4 text-muted-foreground">{icon}</div>}
      </CardHeader>
      <CardContent>
        <div className={`font-bold text-2xl ${valueColorClass}`}>{value}</div>
        {description && (
          <p className="text-muted-foreground text-xs">{description}</p>
        )}
        {trend && (
          <p
            className={`mt-1 text-xs ${
              trend.isPositive ? "text-green-600" : "text-red-600"
            }`}
          >
            {trend.value}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
