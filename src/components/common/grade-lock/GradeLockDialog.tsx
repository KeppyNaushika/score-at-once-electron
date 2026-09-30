"use client"

import { Lock } from "lucide-react"

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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
        <div className="max-h-72 scroll-fade space-y-3 overflow-y-auto">
          {message.groups.map((group) => (
            <section
              key={group.gradeId}
              className="overflow-hidden rounded-md border border-amber-200 dark:border-amber-900"
            >
              <h3 className="bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                {group.gradeName}
              </h3>
              <Table>
                <TableHeader className="text-xs">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="h-auto bg-transparent px-3 py-1 font-normal text-muted-foreground">
                      評価項目
                    </TableHead>
                    <TableHead className="h-auto bg-transparent px-3 py-1 font-normal text-muted-foreground">
                      データソース
                    </TableHead>
                    <TableHead className="h-auto bg-transparent px-3 py-1 font-normal text-muted-foreground">
                      種類
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {group.rows.map((row) => (
                    <TableRow
                      key={`${row.gradeItemName}\u0000${row.dataSourceName}\u0000${row.dataSourceTypeLabel}`}
                    >
                      <TableCell className="px-3 py-1">
                        {row.gradeItemName}
                        {row.isFrozen && (
                          <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                            確定済み
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="px-3 py-1 whitespace-normal">
                        {row.dataSourceName}
                      </TableCell>
                      <TableCell className="px-3 py-1 text-muted-foreground">
                        {row.dataSourceTypeLabel}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </section>
          ))}
        </div>
        {message.frozenNote && (
          <p className="text-sm text-muted-foreground">{message.frozenNote}</p>
        )}
        <p className="text-sm text-muted-foreground">
          「編集する」を押すと、{subject}
          を離れるまで、どのタブでも編集できます。
        </p>
        <AlertDialogFooter>
          <AlertDialogCancel>キャンセル</AlertDialogCancel>
          <AlertDialogAction onClick={onUnlock}>編集する</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
