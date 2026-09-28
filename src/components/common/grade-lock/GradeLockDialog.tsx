"use client"

import { Lock } from "lucide-react"

import { ScrollShadowArea } from "@/components/common/ScrollShadowArea"
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
import type { GradeLockSource } from "@/types/gradeLock.types"

interface GradeLockDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** ロックしているものを言う主語（「この試験」「この資料」） */
  subject: string
  sources: GradeLockSource[]
  /** 「編集する」で確認したとき */
  onUnlock: () => void
}

/**
 * ロックを解除する前の確認。どの成績算出のどの項目で使われているかと、変えると
 * その成績の点数が変わることを見せる。
 *
 * 解除は試験・資料単位で、その中にいる間（タブを移っても）続く（`GradeLockProvider`）。
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
      <AlertDialogContent className="sm:max-w-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Lock className="h-4 w-4" />
            成績算出で使われています
          </AlertDialogTitle>
          <AlertDialogDescription>{message.lead}</AlertDialogDescription>
        </AlertDialogHeader>
        {/* 成績算出ごとに、評価項目とデータソースを表で並べる */}
        <ScrollShadowArea className="max-h-72 space-y-3">
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
        </ScrollShadowArea>
        <p className="text-sm text-muted-foreground">
          {message.frozenNote}
          解除は{subject}を離れるまで、どのタブでも続きます。
        </p>
        <AlertDialogFooter>
          <AlertDialogCancel>キャンセル</AlertDialogCancel>
          <AlertDialogAction onClick={onUnlock}>編集する</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
