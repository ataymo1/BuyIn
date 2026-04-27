"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Column<T> {
  key: string;
  header: ReactNode;
  className?: string;
  render?: (item: T) => ReactNode;
}

interface ResponsiveTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (item: T) => string;
  renderCard: (item: T) => ReactNode;
  className?: string;
  tableClassName?: string;
  cardsClassName?: string;
}

export function ResponsiveTable<T>({
  data,
  columns,
  keyExtractor,
  renderCard,
  className,
  tableClassName,
  cardsClassName,
}: ResponsiveTableProps<T>) {
  return (
    <div className={cn(className)}>
      <div className={cn("hidden md:block", tableClassName)}>
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead key={column.key} className={column.className}>
                  {column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((item) => (
              <TableRow key={keyExtractor(item)}>
                {columns.map((column) => (
                  <TableCell key={column.key} className={column.className}>
                    {column.render
                      ? column.render(item)
                      : ((item as Record<string, unknown>)[column.key] as ReactNode)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className={cn("space-y-3 md:hidden", cardsClassName)}>
        {data.map((item) => (
          <div key={keyExtractor(item)}>{renderCard(item)}</div>
        ))}
      </div>
    </div>
  );
}
