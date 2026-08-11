"use client"

import {
  ChevronDown,
  ChevronRight,
  FileText,
  RotateCcw,
  RotateCw,
  Trash2,
} from "lucide-react"
import Image from "next/image"
import { useMemo, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import type {
  ImportedFile,
  NUpLayout,
  RotationDegree,
} from "@/types/pdfTools.types"

interface ImportedFileItemProps {
  file: ImportedFile
  excludedPages: Set<string>
  onRemove: () => void
  onUpdate: (file: ImportedFile) => void
  onResetExcluded: () => void
  isProcessing: boolean
}

export default function ImportedFileItem({
  file,
  excludedPages,
  onRemove,
  onUpdate,
  onResetExcluded,
  isProcessing,
}: ImportedFileItemProps) {
  const [isOpen, setIsOpen] = useState(false)

  // このファイルの除外ページ数を算出
  const excludedCount = useMemo(() => {
    let count = 0
    for (const key of excludedPages) {
      if (key.startsWith(`${file.id}:`)) count++
    }
    return count
  }, [excludedPages, file.id])

  const handleNUpChange = (value: string) => {
    const enabled = value !== "1in1"
    const layout = value === "1in1" ? "2x1" : (value as NUpLayout)
    onUpdate({
      ...file,
      nUp: { ...file.nUp, enabled, layout },
    })
  }

  const handleRotationChange = (value: string) => {
    onUpdate({
      ...file,
      rotation: parseInt(value) as RotationDegree,
    })
  }

  const handlePageToggle = (pageNumber: number) => {
    const newSelectedPages = new Set(file.selectedPages)
    if (newSelectedPages.has(pageNumber)) {
      newSelectedPages.delete(pageNumber)
    } else {
      newSelectedPages.add(pageNumber)
    }
    onUpdate({ ...file, selectedPages: newSelectedPages })
  }

  const handleSelectAll = () => {
    const newSelectedPages = new Set<number>()
    for (let i = 1; i <= file.pageCount; i++) {
      newSelectedPages.add(i)
    }
    onUpdate({ ...file, selectedPages: newSelectedPages })
  }

  const handleDeselectAll = () => {
    onUpdate({ ...file, selectedPages: new Set<number>() })
  }

  const nUpValue = file.nUp.enabled ? file.nUp.layout : "1in1"
  const selectedCount = file.selectedPages.size

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="rounded-lg border bg-card">
        <CollapsibleTrigger asChild>
          <div className="flex cursor-pointer items-center gap-2 p-3 hover:bg-muted/50">
            {isOpen ? (
              <ChevronDown className="h-4 w-4 shrink-0" />
            ) : (
              <ChevronRight className="h-4 w-4 shrink-0" />
            )}
            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{file.name}</p>
              <div className="flex items-center gap-1.5">
                <p className="text-xs text-muted-foreground">
                  {selectedCount}/{file.pageCount}ページ選択
                </p>
                {excludedCount > 0 && (
                  <div className="flex items-center gap-0.5">
                    <Badge
                      variant="destructive"
                      className="h-4 px-1 py-0 text-[10px]"
                    >
                      削除 {excludedCount}ページ
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-4 w-4"
                      onClick={(e) => {
                        e.stopPropagation()
                        onResetExcluded()
                      }}
                      title="削除をリセット"
                    >
                      <RotateCcw className="h-2.5 w-2.5" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={(e) => {
                e.stopPropagation()
                onRemove()
              }}
              disabled={isProcessing}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t p-3">
            {/* 元PDFの情報 */}
            <p className="mb-3 text-xs text-muted-foreground">
              {describeSourcePdf(file)}
            </p>

            {/* 変換設定 */}
            <div className="mb-3 flex flex-wrap gap-2">
              <Select value={nUpValue} onValueChange={handleNUpChange}>
                <SelectTrigger className="h-8 w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1in1">1in1</SelectItem>
                  <SelectItem value="2x1">2in1(横)</SelectItem>
                  <SelectItem value="1x2">2in1(縦)</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={file.rotation.toString()}
                onValueChange={handleRotationChange}
              >
                <SelectTrigger className="h-8 w-20">
                  <RotateCw className="mr-1 h-3 w-3" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">0°</SelectItem>
                  <SelectItem value="90">90°</SelectItem>
                  <SelectItem value="180">180°</SelectItem>
                  <SelectItem value="270">270°</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={handleSelectAll}
                >
                  全選択
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={handleDeselectAll}
                >
                  全解除
                </Button>
              </div>
            </div>

            {/* ページサムネイル（多ページ時は縦スクロール） */}
            <div className="grid max-h-80 grid-cols-4 gap-2 overflow-x-hidden overflow-y-auto">
              {file.thumbnails.map((thumbnail, index) => {
                const pageNumber = index + 1
                const isSelected = file.selectedPages.has(pageNumber)
                return (
                  <button
                    key={pageNumber}
                    type="button"
                    onClick={() => handlePageToggle(pageNumber)}
                    className={cn(
                      "relative aspect-3/4 overflow-hidden rounded border-2 transition-all",
                      isSelected
                        ? "border-primary ring-2 ring-primary/20"
                        : "border-muted hover:border-muted-foreground/50"
                    )}
                  >
                    {thumbnail ? (
                      <Image
                        src={thumbnail}
                        alt={`Page ${pageNumber}`}
                        fill
                        unoptimized
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-muted">
                        <span className="text-xs text-muted-foreground">
                          {pageNumber}
                        </span>
                      </div>
                    )}
                    <span
                      className={cn(
                        "absolute right-0 bottom-0 left-0 bg-black/60 py-0.5 text-center text-xs text-white",
                        !isSelected && "opacity-50"
                      )}
                    >
                      {pageNumber}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}

/** ポイント(1/72 inch)をミリメートルへ換算する */
function pointToMillimeter(point: number): number {
  return Math.round((point * 25.4) / 72)
}

/** 元PDFのページ数・ページサイズ・暗号化有無を1行にまとめる */
function describeSourcePdf(file: ImportedFile): string {
  const { sourcePdfMetadata } = file
  if (!sourcePdfMetadata) {
    // 元PDFを読めなかった場合はページ数（画像変換から導出）だけを出す
    return `${file.pageCount}ページ`
  }

  const pageWidth = pointToMillimeter(sourcePdfMetadata.pageWidth)
  const pageHeight = pointToMillimeter(sourcePdfMetadata.pageHeight)
  return [
    `${sourcePdfMetadata.pageCount}ページ`,
    `${pageWidth}×${pageHeight}mm`,
    sourcePdfMetadata.isEncrypted ? "暗号化あり" : "暗号化なし",
  ].join(" / ")
}
