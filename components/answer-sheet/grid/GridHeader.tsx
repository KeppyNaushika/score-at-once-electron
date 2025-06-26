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
      <TableHead className="min-w-48 border-r border-border bg-muted/50">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4" />
          <span className="font-medium">生徒</span>
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          受験生徒順
        </div>
      </TableHead>

      {/* ページ列ヘッダー */}
      {Array.from({ length: maxPages }, (_, i) => {
        const pageNumber = i + 1
        const pageState = pageStates[pageNumber]
        
        return (
          <TableHead 
            key={pageNumber}
            className={`text-center min-w-32 border-r border-border ${
              pageState?.isEnabled ? 'bg-background' : 'bg-muted/80'
            }`}
          >
            <div className="flex flex-col items-center gap-2">
              {/* ページ番号とアイコン */}
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <span className="font-medium">ページ {pageNumber}</span>
              </div>
              
              {/* ページ状態表示 */}
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={pageState?.isEnabled ?? true}
                  onCheckedChange={() => onTogglePage(pageNumber)}
                  className="data-[state=checked]:bg-primary"
                />
                {!pageState?.isEnabled && (
                  <Badge variant="secondary" className="text-xs">
                    スキップ
                  </Badge>
                )}
              </div>
              
              {/* 説明テキスト */}
              <div className="text-xs text-muted-foreground">
                {pageState?.isEnabled ? '有効' : '無効'}
              </div>
            </div>
          </TableHead>
        )
      })}
    </TableRow>
  )
}