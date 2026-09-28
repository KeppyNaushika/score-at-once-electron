"use client"

import { Lock, LockOpen } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"

import { GradeLockDialog } from "./GradeLockDialog"
import { useGradeLock } from "./GradeLockProvider"

/**
 * 試験・資料の画面上部のロック表示（layout がタブの下に置く）。成績算出で
 * 使われていなければ何も出さない。
 * ロック中は押して確認すると解除し、解除中はそのことだけを控えめに出す。
 */
export function GradeLockBar() {
  const { subject, sources, locked, unlock } = useGradeLock()
  const [open, setOpen] = useState(false)
  if (sources.length === 0) return null

  if (!locked) {
    return (
      <div className="flex shrink-0 items-center gap-2 border-b bg-muted/40 px-4 py-1.5 text-xs text-muted-foreground">
        <LockOpen className="h-3.5 w-3.5" />
        {`成績算出で使われていますが、ロックを解除しています（${subject}を離れると再びロックされます）`}
      </div>
    )
  }

  return (
    <div className="flex shrink-0 items-center justify-between gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
      <span className="flex items-center gap-2">
        <Lock className="h-4 w-4 shrink-0" />
        {`${subject}は成績算出で使われているため、ロックしています。`}
      </span>
      <Button
        variant="outline"
        size="sm"
        className="shrink-0"
        onClick={() => setOpen(true)}
      >
        <Lock className="mr-1 h-3.5 w-3.5" />
        ロックを解除
      </Button>
      <GradeLockDialog
        open={open}
        onOpenChange={setOpen}
        subject={subject}
        sources={sources}
        onUnlock={unlock}
      />
    </div>
  )
}
