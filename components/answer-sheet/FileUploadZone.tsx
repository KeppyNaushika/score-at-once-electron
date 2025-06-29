"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { RefreshCw, Upload } from "lucide-react"
import { useDropzone } from "react-dropzone"

interface FileUploadZoneProps {
  onDrop: (files: File[]) => void
  isConverting: boolean
  disabled?: boolean
  masterImageCount: number
  pdfProcessingProgress: number
}

export default function FileUploadZone({
  onDrop,
  isConverting,
  disabled = false,
  masterImageCount,
  pdfProcessingProgress,
}: FileUploadZoneProps) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".png", ".jpg", ".jpeg", ".tiff", ".bmp"],
      "application/pdf": [".pdf"],
    },
    multiple: true,
    disabled: disabled || isConverting,
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <div className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            <span className="font-semibold">ファイルアップロード</span>
            <Badge variant="outline">{masterImageCount}ページ</Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div
          {...getRootProps()}
          className={`rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
            disabled
              ? "cursor-not-allowed border-gray-200 bg-gray-50 opacity-50"
              : isDragActive
                ? "border-primary bg-primary/5 cursor-pointer"
                : "border-muted-foreground/25 hover:border-muted-foreground/50 cursor-pointer"
          }`}
        >
          <input {...getInputProps()} />
          {isConverting ? (
            <div className="space-y-4">
              <RefreshCw className="text-primary mx-auto h-12 w-12 animate-spin" />
              <p className="text-lg">ファイルを変換中...</p>
            </div>
          ) : disabled ? (
            <div className="space-y-4">
              <Upload className="mx-auto mb-4 h-12 w-12 text-gray-400" />
              <p className="text-lg text-gray-500">
                模範解答が登録されていないため、アップロードは無効です
              </p>
            </div>
          ) : (
            <>
              <Upload className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
              {isDragActive ? (
                <p className="text-lg">ファイルをドロップしてください...</p>
              ) : (
                <p className="text-lg">
                  ファイルをドラッグ&ドロップするか、クリックして選択
                </p>
              )}
            </>
          )}
        </div>

        {/* 処理中プログレス */}
        {isConverting && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>ファイル処理中...</span>
              <span>{pdfProcessingProgress}%</span>
            </div>
            <Progress value={pdfProcessingProgress} className="w-full" />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
