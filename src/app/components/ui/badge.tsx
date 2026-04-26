import * as React from "react";
import { cn } from "../../lib/utils";

export function Badge({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("inline-flex min-w-0 items-center rounded-md border border-border/70 bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground transition-colors", className)}
      {...props}
    />
  );
}
