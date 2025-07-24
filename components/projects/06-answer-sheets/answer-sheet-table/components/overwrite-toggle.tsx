"use client"

import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { AlertTriangle } from "lucide-react"

interface OverwriteToggleProps {
  allowOverwrite: boolean
  onAllowOverwriteChange: (allow: boolean) => void
}

export function OverwriteToggle({
  allowOverwrite,
  onAllowOverwriteChange,
}: OverwriteToggleProps) {
  return (
    <div className="flex items-center gap-2">
      <Switch
        id="overwrite-toggle"
        checked={allowOverwrite}
        onCheckedChange={onAllowOverwriteChange}
      />
      <Label htmlFor="overwrite-toggle" className="flex items-center gap-1 text-sm">
        {allowOverwrite && (
          <AlertTriangle className="h-3 w-3 text-orange-500" />
        )}
        答案上書き
      </Label>
    </div>
  )
}