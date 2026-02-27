"use client"

import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

interface ModelAnswerEditorProps {
  value: string | undefined
  onChange: (value: string) => void
}

export function ModelAnswerEditor({ value, onChange }: ModelAnswerEditorProps) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">模範解答</Label>
      <Textarea
        className="min-h-[2rem] resize-none text-xs"
        rows={2}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder="模範解答（模範解答モードで表示）"
      />
    </div>
  )
}
