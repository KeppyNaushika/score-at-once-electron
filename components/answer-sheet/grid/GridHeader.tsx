"use client"

import { TableHead, TableRow } from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
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
            className={`text-center min-w-28 border-r border-border p-1 ${
              pageState?.isEnabled ? 'bg-background' : 'bg-muted/80'
            }`}
          >
            <div className="flex flex-col items-center gap-1">
              {/* ページ番号 */}
              <div className="flex items-center gap-1">
                <FileText className="h-3 w-3" />
                <span className="font-medium text-xs">{pageNumber}ページ</span>
              </div>
              
              {/* ページ配置チェック */}
              <div className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={pageState?.isEnabled ?? true}
                  onChange={() => onTogglePage(pageNumber)}
                  className="h-3 w-3"
                />
                <span className="text-xs">配置</span>
              </div>
            </div>
          </TableHead>
        )
      })}
    </TableRow>
  )
}