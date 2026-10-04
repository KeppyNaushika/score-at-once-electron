"use client"

import { AlertCircle } from "lucide-react"

interface ExportErrorBandProps {
  title: string
  message: string
}

/** 書き出しダイアログの中に出す失敗の帯（閉じずにその場で知らせる） */
export function ExportErrorBand({ title, message }: ExportErrorBandProps) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-destructive/20 bg-destructive/10 p-4"
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
        <div className="flex-1">
          <p className="text-sm font-medium text-destructive">{title}</p>
          <p className="mt-1 text-sm break-all text-destructive/80">
            {message}
          </p>
        </div>
      </div>
    </div>
  )
}
