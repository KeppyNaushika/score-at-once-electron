"use client"

import { Label } from "@/components/ui/label"
import { RadioGroupItem } from "@/components/ui/radio-group"

import type { StrategyOptionProps } from "./types"

/**
 * 方針選択オプション
 */
export function StrategyOption({
  value,
  id,
  label,
  description,
  recommended,
}: StrategyOptionProps) {
  return (
    <div className="flex items-start space-x-3">
      <RadioGroupItem value={value} id={id} />
      <div className="flex-1">
        <Label htmlFor={id} className="cursor-pointer font-medium">
          {label}
          {recommended && (
            <span className="ml-2 rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700 dark:bg-blue-900 dark:text-blue-300">
              推奨
            </span>
          )}
        </Label>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
    </div>
  )
}
