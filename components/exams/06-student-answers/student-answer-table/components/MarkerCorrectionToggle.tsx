"use client"

import { Crosshair } from "lucide-react"

import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface MarkerCorrectionToggleProps {
  enabled: boolean
  available: boolean
  diagnostics?: string
  onChange: (enabled: boolean) => void
}

export function MarkerCorrectionToggle({
  enabled,
  available,
  diagnostics,
  onChange,
}: MarkerCorrectionToggleProps) {
  const toggle = (
    <div className="flex items-center gap-2">
      <Switch
        id="marker-correction-toggle"
        checked={enabled}
        onCheckedChange={onChange}
        disabled={!available}
      />
      <Label
        htmlFor="marker-correction-toggle"
        className={`flex items-center gap-1 text-sm ${
          !available ? "text-gray-400" : ""
        }`}
      >
        <Crosshair
          className={`h-3 w-3 transition-opacity ${
            enabled && available
              ? "text-blue-500 opacity-100"
              : "text-gray-400 opacity-30"
          }`}
        />
        マーカー補正
      </Label>
    </div>
  )

  if (!available) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{toggle}</TooltipTrigger>
          <TooltipContent className="max-w-sm">
            <p className="font-medium">模範解答にマーカーが検出できません</p>
            {diagnostics && (
              <pre className="mt-1 text-xs whitespace-pre-wrap text-gray-300">
                {diagnostics}
              </pre>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return toggle
}
