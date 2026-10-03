import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const kbdVariants = cva(
  [
    "pointer-events-none inline-flex h-5 w-fit min-w-5 items-center justify-center gap-1 rounded-sm bg-muted px-1 font-sans text-xs font-medium text-muted-foreground select-none",
    "[&_svg:not([class*='size-'])]:size-3",
    "in-data-[slot=tooltip-content]:bg-background/20 in-data-[slot=tooltip-content]:text-background dark:in-data-[slot=tooltip-content]:bg-background/10",
  ],
  {
    variants: {
      variant: {
        default: "",
        /** 灰色の地に等幅（描画ツールのキー） */
        subtle:
          "min-w-0 rounded bg-gray-200 font-mono font-normal text-gray-800",
        /** 白地に枠と余白（部分点の入力欄のキーの一覧） */
        outlined:
          "h-auto rounded border bg-white px-2 py-1 font-mono font-normal text-inherit",
        /** 文中の小さなキー（10px） */
        tiny: "h-auto min-w-0 rounded bg-gray-100 py-0.5 font-mono text-[10px] font-normal text-inherit",
        /** 文中の小さなキーに枠を付けたもの（10px） */
        tinyOutlined:
          "h-auto min-w-0 rounded border border-gray-300 bg-white font-mono text-[10px] font-normal text-gray-600",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Kbd({
  className,
  variant,
  ...props
}: React.ComponentProps<"kbd"> & VariantProps<typeof kbdVariants>) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(kbdVariants({ variant }), className)}
      {...props}
    />
  )
}

function KbdGroup({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      data-slot="kbd-group"
      className={cn("inline-flex items-center gap-1", className)}
      {...props}
    />
  )
}

export { Kbd, KbdGroup }
