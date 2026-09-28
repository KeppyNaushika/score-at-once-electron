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
      <AlertDialogContent
        className="sm:max-w-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Lock className="h-4 w-4" />
            成績算出で使われています
          </AlertDialogTitle>
          <AlertDialogDescription>{message.lead}</AlertDialogDescription>
        </AlertDialogHeader>
        {/* 成績算出ごとに、評価項目とデータソースを表で並べる */}
        <div className="max-h-72 space-y-3 overflow-y-auto">
          {message.groups.map((group) => (
            <section
              key={group.gradeId}
              className="overflow-hidden rounded-md border border-amber-200 dark:border-amber-900"
            >
              <h3 className="bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                {group.gradeName}
              </h3>
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr className="border-b">
                    <th className="px-3 py-1 text-left font-normal">
                      評価項目
                    </th>
                    <th className="px-3 py-1 text-left font-normal">
                      データソース
                    </th>
                    <th className="px-3 py-1 text-left font-normal">種類</th>
                  </tr>
                </thead>
                <tbody>
                  {group.rows.map((row) => (
                    <tr
                      key={`${row.gradeItemName}\u0000${row.dataSourceName}\u0000${row.dataSourceTypeLabel}`}
                      className="border-b last:border-b-0"
                    >
                      <td className="px-3 py-1 whitespace-nowrap">
                        {row.gradeItemName}
                      </td>
                      <td className="px-3 py-1">{row.dataSourceName}</td>
                      <td className="px-3 py-1 whitespace-nowrap text-muted-foreground">
                        {row.dataSourceTypeLabel}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
        </div>
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
