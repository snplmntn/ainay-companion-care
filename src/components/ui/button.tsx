import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-lg font-semibold ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-5 [&_svg]:shrink-0 active:scale-95",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:brightness-110 shadow-lg shadow-primary/30",
        destructive: "bg-destructive text-destructive-foreground hover:brightness-110",
        outline: "border-2 border-primary text-primary bg-transparent hover:bg-primary/10",
        secondary: "bg-secondary text-secondary-foreground hover:brightness-110 shadow-lg shadow-secondary/30",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        coral: "bg-gradient-to-br from-primary to-[hsl(16_100%_72%)] text-white hover:brightness-110 shadow-lg shadow-primary/40",
        teal: "bg-gradient-to-br from-secondary to-[hsl(174_56%_55%)] text-white hover:brightness-110 shadow-lg shadow-secondary/40",
        muted: "bg-muted text-muted-foreground hover:bg-muted/80",
      },
      size: {
        default: "min-h-[50px] px-6 py-3",
        sm: "min-h-[44px] px-4 py-2 text-base",
        lg: "min-h-[56px] px-8 py-4 text-xl",
        xl: "min-h-[64px] px-10 py-5 text-2xl",
        icon: "min-h-[50px] min-w-[50px] p-3",
        "icon-lg": "min-h-[64px] min-w-[64px] p-4",
        "icon-xl": "min-h-[80px] min-w-[80px] p-5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
