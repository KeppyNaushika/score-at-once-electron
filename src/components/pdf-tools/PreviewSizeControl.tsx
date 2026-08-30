"use client"

import { ZoomIn, ZoomOut } from "lucide-react"

import { Button } from "@/components/ui/button"

/** ページプレビューの列数（1行あたりの枚数）の範囲と初期値 */
export const PREVIEW_COLUMNS_MIN = 2
export const PREVIEW_COLUMNS_MAX = 10
export const PREVIEW_COLUMNS_DEFAULT = 4

interface PreviewSizeControlProps {
  columns: number
  onColumnsChange: (columns: number) => void
}

/**
 * ページプレビューの表示サイズを変える
 *
 * 実際に変わるのは1行あたりの枚数なので、連続量ではなく枚数の増減で操作する
 */
export default function PreviewSizeControl({
  columns,
  onColumnsChange,
}: PreviewSizeControlProps) {
  return (
    <div className="flex items-center gap-1">
      <span className="mr-1 text-sm text-muted-foreground">
        ページプレビュー
      </span>
      <Button
        variant="outline"
        size="sm"
        className="h-8 w-8 p-0"
        onClick={() => onColumnsChange(columns + 1)}
        disabled={columns >= PREVIEW_COLUMNS_MAX}
        title="小さくする（1行の枚数を増やす）"
      >
        <ZoomOut className="h-4 w-4" />
      </Button>
      <span className="w-14 text-center text-sm tabular-nums">
        {columns}枚/行
      </span>
      <Button
        variant="outline"
        size="sm"
        className="h-8 w-8 p-0"
        onClick={() => onColumnsChange(columns - 1)}
        disabled={columns <= PREVIEW_COLUMNS_MIN}
        title="大きくする（1行の枚数を減らす）"
      >
        <ZoomIn className="h-4 w-4" />
      </Button>
    </div>
  )
}
