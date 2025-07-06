"use client"

import { FileText, User } from "lucide-react"

import { TableHead, TableRow } from "@/components/ui/table"
import type { GridHeaderProps } from "@/components/projects/05-answer-sheets/answer-sheet-management/types"

export function GridHeader({ 
  maxPages, 
  pageStates, 
  onTogglePage 
}: GridHeaderProps) {
  return (
    <TableRow>
      {/* 生徒列ヘッダー */}
      <TableHead className="min-w-36 border-r border-border bg-muted/50 p-2">
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-1">
            <User className="h-3 w-3" />
            <span className="font-medium text-xs">生徒</span>
          </div>
          <div className="text-xs text-muted-foreground">
            受験生徒順
          </div>
        </div>
      </TableHead>

      {/* ページ列ヘッダー */}
      {Array.from({ length: maxPages }, (_, i) => {
        const pageNumber = i + 1
        const isPageDisabled = pageStates.has(i)
        
        return (
          <TableHead 
            key={pageNumber}
            className={`text-center min-w-32 border-r border-border p-1 cursor-pointer relative transition-colors hover:bg-muted/50 ${
              !isPageDisabled ? 'bg-background' : 'bg-muted/80'
            }`}
            onClick={() => onTogglePage(i)}
          >
            <div className="flex flex-col items-center gap-1">
              {/* ホバー時のツールチップ */}
              <div className="absolute inset-0 bg-transparent opacity-0 hover:opacity-100 transition-opacity z-20 flex items-center justify-center">
                <div className="text-slate-800 text-xs font-medium">
                  {!isPageDisabled ? 'クリックしてページを除外' : 'クリックしてページを表示'}
                </div>
              </div>

              {/* ページ番号 */}
              <div className="flex items-center gap-1">
                <FileText className="h-3 w-3" />
                <span className="font-medium text-xs">{pageNumber}ページ</span>
              </div>
              
              {/* ページ状態表示 */}
              <div className="text-xs text-muted-foreground">
                {!isPageDisabled ? 'クリックして除外' : 'クリックして表示'}
              </div>
            </div>
          </TableHead>
        )
      })}
    </TableRow>
  )
}