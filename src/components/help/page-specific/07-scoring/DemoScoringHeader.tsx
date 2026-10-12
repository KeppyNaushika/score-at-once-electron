"use client"

import { RotateCcw } from "lucide-react"

import { Button } from "@/components/ui/button"

/** 採点体験デモの見出し行（設問例と「やり直す」ボタン） */
export function DemoScoringHeader({
  questionExample,
  onReset,
}: {
  questionExample: string
  onReset: () => void
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <p className="text-xs text-gray-500">設問例「{questionExample}」</p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onReset}
        className="h-7 gap-1 text-xs"
      >
        <RotateCcw className="h-3 w-3" />
        やり直す
      </Button>
    </div>
  )
}
