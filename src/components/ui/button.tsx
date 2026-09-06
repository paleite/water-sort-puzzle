"use client";

import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-xl font-medium outline-none transition-[background-color,color,box-shadow,transform] focus-visible:ring-3 focus-visible:ring-sky-500/30 disabled:pointer-events-none disabled:opacity-45 active:translate-y-px",
  {
    variants: {
      variant: {
        default: "bg-slate-900 text-white hover:bg-slate-800",
        secondary: "bg-white/75 text-slate-900 ring-1 ring-slate-900/10 hover:bg-white",
        ghost: "text-slate-700 hover:bg-white/55",
        outline: "bg-white/45 text-slate-900 ring-1 ring-slate-900/15 hover:bg-white/70"
      },
      size: {
        default: "h-9 px-3 text-sm",
        lg: "h-12 px-5 text-base",
        icon: "size-10",
        "icon-lg": "size-11"
      }
    },
    defaultVariants: {variant: "default", size: "default"}
  }
);

export function Button({
  className,
  variant,
  size,
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      className={cn(buttonVariants({variant, size}), className)}
      {...props}
    />
  );
}
