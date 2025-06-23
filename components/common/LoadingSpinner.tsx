"use client"

import { cn } from "@/lib/utils"
import { Loader2 } from "lucide-react"
import React from "react"

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg"
  text?: string
  className?: string
  inline?: boolean
}

const sizeClasses = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-8 w-8",
}

const LoadingSpinner = React.memo(
  ({ size = "md", text, className, inline = false }: LoadingSpinnerProps) => {
    if (inline) {
      return (
        <div className={cn("flex items-center space-x-2", className)}>
          <Loader2 className={cn("animate-spin", sizeClasses[size])} />
          {text && (
            <span className="text-muted-foreground text-sm">{text}</span>
          )}
        </div>
      )
    }

    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center p-8",
          className,
        )}
      >
        <Loader2 className={cn("mb-2 animate-spin", sizeClasses[size])} />
        {text && <p className="text-muted-foreground text-sm">{text}</p>}
      </div>
    )
  },
)

LoadingSpinner.displayName = "LoadingSpinner"

export default LoadingSpinner
