"use client"

import * as TooltipPrimitive from "@radix-ui/react-tooltip"
import * as React from "react"

import { cn } from "@/lib/utils"

function TooltipProvider({
  delayDuration = 0,
  disableHoverableContent = true,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      disableHoverableContent={disableHoverableContent}
      {...props}
    />
  )
}

function Tooltip({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return (
    <TooltipProvider>
      <TooltipPrimitive.Root data-slot="tooltip" {...props} />
    </TooltipProvider>
  )
}

/**
 * フォーカスで Tooltip を開いてよいのは、利用者がキーでフォーカスを動かしたときだけ。
 * Dialog・AlertDialog・Popover などは閉じるとフォーカスを開いたボタンへ戻すが、
 * そのボタンに Tooltip があると、戻っただけで Tooltip が開いてしまう。
 *
 * `:focus-visible` では見分けられない。Chromium（Electron）は直前の操作がキーなら
 * プログラムによる focus() も `:focus-visible` にするので、Esc で閉じた直後に戻った
 * フォーカスは、マウスで開いた窓であっても `:focus-visible` になる。
 * そこで、直前の入力がフォーカスを動かすキーだったかを文書全体で覚えておく。
 */
const FOCUS_NAVIGATION_KEYS = new Set([
  "Tab",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Home",
  "End",
])

let isLastInputFocusNavigation = false
let isInputListenerInstalled = false

function recordKeyDown(event: KeyboardEvent) {
  isLastInputFocusNavigation = FOCUS_NAVIGATION_KEYS.has(event.key)
}

function recordPointerDown() {
  isLastInputFocusNavigation = false
}

function installInputListener() {
  if (isInputListenerInstalled) return
  isInputListenerInstalled = true
  // 捕獲段で聞くのは、窓の中で stopPropagation されたキーも取りこぼさないため
  document.addEventListener("keydown", recordKeyDown, true)
  document.addEventListener("pointerdown", recordPointerDown, true)
}

function TooltipTrigger({
  onFocus,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  React.useEffect(installInputListener, [])

  return (
    <TooltipPrimitive.Trigger
      data-slot="tooltip-trigger"
      onFocus={(event) => {
        onFocus?.(event)
        // Radix は onFocus で開く。preventDefault すると Radix 側の処理だけを飛ばせる
        if (!isLastInputFocusNavigation) event.preventDefault()
      }}
      {...props}
    />
  )
}

function TooltipContent({
  className,
  sideOffset = 0,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          "z-50 w-fit origin-(--radix-tooltip-content-transform-origin) animate-in rounded-md bg-primary px-3 py-1.5 text-xs text-balance text-primary-foreground fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
          className
        )}
        {...props}
      >
        {children}
        <TooltipPrimitive.Arrow className="z-50 size-2.5 translate-y-[calc(-50%-2px)] rotate-45 rounded-[2px] bg-primary fill-primary" />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  )
}

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger }
