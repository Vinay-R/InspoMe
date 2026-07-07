import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary/10 text-primary",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground",
        outline: "border-border text-foreground",
        success: "border-transparent bg-success/15 text-[#047857] dark:text-emerald-400",
        warning: "border-transparent bg-warning/15 text-[#b45309] dark:text-amber-400",
        danger: "border-transparent bg-destructive/12 text-destructive",
        brand: "border-transparent bg-brand/15 text-[#b04518] dark:text-brand",
        glass:
          "border-transparent bg-white/85 text-foreground backdrop-blur-sm dark:bg-neutral-900/70",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
