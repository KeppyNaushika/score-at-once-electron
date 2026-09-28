"use client"

import { Lock } from "lucide-react"
import { useState } from "react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { buildGradeLockMessage } from "@/lib/gradeLock"
import { cn } from "@/lib/utils"
import type { GradeLockSource } from "@/types/gradeLock.types"

interface GradeLockDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** ロックしている欄を言う主語（「この設問の配点・種類」など） */
  subject: string
  sources: GradeLockSource[]
  /** 「編集する」で確認したとき */
  onUnlock: () => void
}

/**
 * ロックを解除する前の確認。どの成績算出のどの項目で使われているかと、変えると
 * その成績の点数が変わることを見せる。
 */
export function GradeLockDialog({
  open,
  onOpenChange,
  subject,
  sources,
  onUnlock,
}: GradeLockDialogProps) {
  const message = buildGradeLockMessage(subject, sources)
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      {/*
        ポータルの中のクリックも React の木をたどって親へ上がる。表の行に置いたとき、
        「編集する」で行の選択が切り替わらないよう止める
      */}
      <AlertDialogContent onClick={(event) => event.stopPropagation()}>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Lock className="h-4 w-4" />
            成績算出で使われています
          </AlertDialogTitle>
          <AlertDialogDescription>{message.lead}</AlertDialogDescription>
        </AlertDialogHeader>
        <ul className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {message.sourceLines.map((line) => (
            <li key={line}>・{line}</li>
          ))}
        </ul>
        <p className="text-sm text-muted-foreground">
          {message.frozenNote}
          解除はこのページを離れるまで有効です。
        </p>
        <AlertDialogFooter>
          <AlertDialogCancel>キャンセル</AlertDialogCancel>
          <AlertDialogAction onClick={onUnlock}>編集する</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

interface LockedByGradeProps {
  subject: string
  sources: GradeLockSource[]
  onUnlock: () => void
  className?: string
}

/**
 * 成績算出で使われている欄に付けるロックのマーク。押すと確認を出し、「編集する」で
 * その単位（行・列・欄）のロックを解除する。
 *
 * 付けるかどうかは呼び出し側が決める（使われていない欄・解除済みの欄には出さない）。
 * 欄そのものは呼び出し側が disabled にする。
 */
export function LockedByGrade({
  subject,
  sources,
  onUnlock,
  className,
}: LockedByGradeProps) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded p-1 text-amber-600 hover:bg-amber-100 dark:text-amber-400 dark:hover:bg-amber-900/40",
          className
        )}
        title="成績算出で使われているためロックしています（押すと編集できます）"
        aria-label="成績算出で使われているためロックしています"
        onClick={(event) => {
          // 行の選択など、親のクリックへ伝えない
          event.stopPropagation()
          setOpen(true)
        }}
      >
        <Lock className="h-3.5 w-3.5" />
      </button>
      <GradeLockDialog
        open={open}
        onOpenChange={setOpen}
        subject={subject}
        sources={sources}
        onUnlock={onUnlock}
      />
    </>
  )
}
