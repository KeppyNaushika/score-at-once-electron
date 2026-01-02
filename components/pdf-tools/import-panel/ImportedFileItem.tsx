"use client"

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
import {
  ChevronDown,
  ChevronRight,
  FileText,
  RotateCw,
  Trash2,
} from "lucide-react"
import { useState } from "react"

interface ImportedFileItemProps {
  file: ImportedFile
  onRemove: () => void
  onUpdate: (file: ImportedFile) => void
  isProcessing: boolean
}

export default function ImportedFileItem({
  file,
  onRemove,
  onUpdate,
  isProcessing,
}: ImportedFileItemProps) {
  const [isOpen, setIsOpen] = useState(false)

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
      <div className="bg-card rounded-lg border">
        <CollapsibleTrigger asChild>
          <div className="hover:bg-muted/50 flex cursor-pointer items-center gap-2 p-3">
            {isOpen ? (
              <ChevronDown className="h-4 w-4 shrink-0" />
            ) : (
              <ChevronRight className="h-4 w-4 shrink-0" />
            )}
            <FileText className="text-muted-foreground h-4 w-4 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{file.name}</p>
              <p className="text-muted-foreground text-xs">
                {selectedCount}/{file.pageCount}ページ選択
              </p>
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

            {/* ページサムネイル */}
            <div className="grid grid-cols-4 gap-2">
              {file.thumbnails.map((thumbnail, index) => {
                const pageNumber = index + 1
                const isSelected = file.selectedPages.has(pageNumber)
                return (
                  <button
                    key={pageNumber}
                    type="button"
                    onClick={() => handlePageToggle(pageNumber)}
                    className={cn(
                      "relative aspect-[3/4] overflow-hidden rounded border-2 transition-all",
                      isSelected
                        ? "border-primary ring-primary/20 ring-2"
                        : "border-muted hover:border-muted-foreground/50"
                    )}
                  >
                    {thumbnail ? (
                      <img
                        src={thumbnail}
                        alt={`Page ${pageNumber}`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="bg-muted flex h-full w-full items-center justify-center">
                        <span className="text-muted-foreground text-xs">
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
