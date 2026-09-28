"use client"

import { Lock, LockOpen } from "lucide-react"
import { useCallback, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import type { GradeLockSource } from "@/types/gradeLock.types"

import { GradeLockDialog } from "./LockedByGrade"

/** ロック中に書こうとしたときの通知。キーを押し続けても1つに畳む */
const LOCKED_TOAST_ID = "grade-page-lock"

/**
 * ページ全体を1単位でロックする（採点・点数入力のページ）。
 *
 * 解除は state だけで持つので、ページを離れる・開き直すと再びロックされる。
 * `guard` で包んだ書き込みは、ロック中は何もせず通知だけ出す（キー操作・クリックで
 * 採点しても効かない）。
 */
export function useGradePageLock(sources: GradeLockSource[]) {
  const [unlocked, setUnlocked] = useState(false)
  const locked = sources.length > 0 && !unlocked

  const unlock = useCallback(() => setUnlocked(true), [])

  const guard = useCallback(
    <Args extends unknown[]>(write: (...args: Args) => void) =>
      (...args: Args): void => {
        if (locked) {
          toast.info("成績算出で使われているため、ロックしています", {
            id: LOCKED_TOAST_ID,
            description: "編集するには、画面上部のロックを解除してください。",
          })
          return
        }
        write(...args)
      },
    [locked]
  )

  return { locked, unlock, guard }
}

interface GradeLockBarProps {
  /** ロックしているものを言う主語（「この試験の採点」など） */
  subject: string
  sources: GradeLockSource[]
  locked: boolean
  onUnlock: () => void
}

/**
 * ページ上部のロック表示。成績算出で使われていなければ何も出さない。
 * ロック中は押して確認すると解除し、解除中はそのことだけを控えめに出す。
 */
export function GradeLockBar({
  subject,
  sources,
  locked,
  onUnlock,
}: GradeLockBarProps) {
  const [open, setOpen] = useState(false)
  if (sources.length === 0) return null

  if (!locked) {
    return (
      <div className="flex shrink-0 items-center gap-2 border-b bg-muted/40 px-4 py-1.5 text-xs text-muted-foreground">
        <LockOpen className="h-3.5 w-3.5" />
        成績算出で使われていますが、ロックを解除しています（このページを離れると再びロックされます）
      </div>
    )
  }

  return (
    <div className="flex shrink-0 items-center justify-between gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
      <span className="flex items-center gap-2">
        <Lock className="h-4 w-4 shrink-0" />
        {subject}は成績算出で使われているため、ロックしています。
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
        onUnlock={onUnlock}
      />
    </div>
  )
}
