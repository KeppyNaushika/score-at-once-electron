"use client"

import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface LegacyArchiveImportDialogFrameProps {
  title: string
  description: string
  /** 取り込み中（閉じられなくし、ボタンを押せなくする） */
  importing: boolean
  onConfirm: () => void
  /** やめたとき */
  onClose: () => void
  children: ReactNode
}

/**
 * 旧形式（.coursework / .grade）の取り込みダイアログの枠。見出しと「キャンセル」「インポート」を持つ。
 * 取り込み中は閉じられない
 */
export function LegacyArchiveImportDialogFrame({
  title,
  description,
  importing,
  onConfirm,
  onClose,
  children,
}: LegacyArchiveImportDialogFrameProps) {
  return (
    <Dialog
      open
      onOpenChange={(nextOpen) => !nextOpen && !importing && onClose()}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {children}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={importing}>
            キャンセル
          </Button>
          <Button onClick={onConfirm} disabled={importing}>
            {importing ? "取り込み中..." : "取り込む"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
