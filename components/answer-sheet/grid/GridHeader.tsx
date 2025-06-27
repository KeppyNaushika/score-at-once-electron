"use client"

import { TableHead, TableRow } from "@/components/ui/table"
import { FileText, User } from "lucide-react"

interface PageState {
  isEnabled: boolean
  isSkipped: boolean
}

interface GridHeaderProps {
  maxPages: number
  pageStates: Record<number, PageState>
  onTogglePage: (pageNumber: number) => void
}

export default function GridHeader({ 
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
        const pageState = pageStates[pageNumber]
        
        return (
          <TableHead 
            key={pageNumber}
            className={`text-center min-w-32 border-r border-border p-1 cursor-pointer relative transition-colors hover:bg-muted/50 ${
              pageState?.isEnabled ? 'bg-background' : 'bg-muted/80'
            }`}
            onClick={() => onTogglePage(pageNumber)}
          >
            <div className="flex flex-col items-center gap-1">
              {/* ホバー時のツールチップ */}
              <div className="absolute inset-0 bg-transparent opacity-0 hover:opacity-100 transition-opacity z-20 flex items-center justify-center">
                <div className="text-slate-800 text-xs font-medium">
                  {pageState?.isEnabled ? 'クリックしてページを除外' : 'クリックしてページを表示'}
                </div>
              </div>

              {/* ページ番号 */}
              <div className="flex items-center gap-1">
                <FileText className="h-3 w-3" />
                <span className="font-medium text-xs">{pageNumber}ページ</span>
              </div>
              
              {/* ページ状態表示 */}
              <div className="text-xs text-muted-foreground">
                {pageState?.isEnabled ? 'クリックしてページを除外' : 'クリックしてページを表示'}
              </div>
            </div>
          </TableHead>
        )
      })}
    </TableRow>
  )
}