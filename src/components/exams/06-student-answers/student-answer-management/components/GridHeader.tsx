"use client"

import { FileText, User } from "lucide-react"

import type { GridHeaderProps } from "@/components/exams/06-student-answers/student-answer-management/types"
import { TableHead, TableRow } from "@/components/ui/table"

export function GridHeader({
  maxPages,
  pageStates,
  onTogglePage,
}: GridHeaderProps) {
  return (
    <TableRow>
      {/* 生徒列ヘッダー */}
      <TableHead className="border-border bg-muted/50 min-w-36 border-r p-2">
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-1">
            <User className="h-3 w-3" />
            <span className="text-xs font-medium">生徒</span>
          </div>
          <div className="text-muted-foreground text-xs">受験生徒順</div>
        </div>
      </TableHead>

      {/* ページ列ヘッダー */}
      {Array.from({ length: maxPages }, (_, i) => {
        const pageNumber = i + 1
        const isPageDisabled = pageStates.has(i)

        return (
          <TableHead
            key={pageNumber}
            className={`border-border hover:bg-muted/50 relative min-w-32 cursor-pointer border-r p-1 text-center transition-colors ${
              !isPageDisabled ? "bg-background" : "bg-muted/80"
            }`}
            onClick={() => onTogglePage(i)}
          >
            <div className="flex flex-col items-center gap-1">
              {/* ホバー時のツールチップ */}
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-transparent opacity-0 transition-opacity hover:opacity-100">
                <div className="text-xs font-medium text-slate-800">
                  {!isPageDisabled
                    ? "クリックしてページを除外"
                    : "クリックしてページを表示"}
                </div>
              </div>

              {/* ページ番号 */}
              <div className="flex items-center gap-1">
                <FileText className="h-3 w-3" />
                <span className="text-xs font-medium">{pageNumber}ページ</span>
              </div>

              {/* ページ状態表示 */}
              <div className="text-muted-foreground text-xs">
                {!isPageDisabled ? "クリックして除外" : "クリックして表示"}
              </div>
            </div>
          </TableHead>
        )
      })}
    </TableRow>
  )
}
