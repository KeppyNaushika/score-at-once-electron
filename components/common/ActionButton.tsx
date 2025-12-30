"use client"

import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { LucideIcon } from "lucide-react"

interface ActionButtonProps {
  icon: LucideIcon
  label: string
  variant?:
    | "default"
    | "destructive"
    | "outline"
    | "secondary"
    | "ghost"
    | "link"
  size?: "default" | "sm" | "lg" | "icon"
  onClick: () => void
  disabled?: boolean
  loading?: boolean
  tooltip?: string
  className?: string
}

export default function ActionButton({
  icon: Icon,
  label,
  variant = "default",
  size = "default",
  onClick,
  disabled = false,
  loading = false,
  tooltip,
  className,
}: ActionButtonProps) {
  const buttonContent = (
    <Button
      variant={variant}
      size={size}
      onClick={onClick}
      disabled={disabled || loading}
      className={className}
    >
      <Icon className={`${size === "icon" ? "h-4 w-4" : "mr-2 h-4 w-4"}`} />
      {size !== "icon" && (loading ? "処理中..." : label)}
    </Button>
  )

  if (tooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{buttonContent}</TooltipTrigger>
          <TooltipContent>
            <p>{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return buttonContent
}
