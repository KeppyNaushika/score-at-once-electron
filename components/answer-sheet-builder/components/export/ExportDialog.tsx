"use client"

import { FileImage, FileText, Printer } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { AnswerSheetDefinition } from "@/types/answerSheetDefinition.types"

import { useAnswerSheetExport } from "../../hooks/useAnswerSheetExport"

interface ExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  definition: AnswerSheetDefinition
}

/**
 * PDF/PNG出力・印刷のダイアログコンポーネント。
 * 出力形式の選択とDPI設定を提供する。
 */
export function ExportDialog({
  open,
  onOpenChange,
  definition,
}: ExportDialogProps) {
  const { exportPdf, exportPng, printSheet, isExporting } =
    useAnswerSheetExport()
  const [dpi, setDpi] = useState(300)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>解答用紙を出力</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <Button
            variant="outline"
            className="h-12 w-full justify-start gap-3"
            disabled={isExporting}
            onClick={() => {
              exportPdf(definition)
              onOpenChange(false)
            }}
          >
            <FileText className="h-5 w-5 text-red-500" />
            <div className="text-left">
              <div className="text-sm font-medium">PDF出力</div>
              <div className="text-muted-foreground text-xs">
                印刷用ベクターPDF
              </div>
            </div>
          </Button>

          <div className="space-y-2">
            <Button
              variant="outline"
              className="h-12 w-full justify-start gap-3"
              disabled={isExporting}
              onClick={() => {
                exportPng(definition, dpi)
                onOpenChange(false)
              }}
            >
              <FileImage className="h-5 w-5 text-blue-500" />
              <div className="text-left">
                <div className="text-sm font-medium">PNG出力</div>
                <div className="text-muted-foreground text-xs">
                  ラスター画像（{dpi} DPI）
                </div>
              </div>
            </Button>
            <div className="flex items-center gap-2 pl-2">
              <Label className="text-muted-foreground text-xs">DPI:</Label>
              <Input
                type="number"
                className="h-7 w-20 text-xs"
                value={dpi}
                min={72}
                max={600}
                step={50}
                onChange={(e) => setDpi(Number(e.target.value))}
              />
            </div>
          </div>

          <Button
            variant="outline"
            className="h-12 w-full justify-start gap-3"
            disabled={isExporting}
            onClick={() => {
              printSheet(definition)
              onOpenChange(false)
            }}
          >
            <Printer className="h-5 w-5 text-green-500" />
            <div className="text-left">
              <div className="text-sm font-medium">印刷</div>
              <div className="text-muted-foreground text-xs">
                システム印刷ダイアログを表示
              </div>
            </div>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
