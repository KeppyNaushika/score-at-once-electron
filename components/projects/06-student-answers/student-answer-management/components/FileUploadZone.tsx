"use client"

import { RefreshCw, Upload } from "lucide-react"
import { useDropzone } from "react-dropzone"

import type { FileUploadZoneProps } from "@/components/projects/06-student-answers/student-answer-management/types"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"

export function FileUploadZone({
  onDrop,
  isConverting,
  disabled = false,
  modelAnswerCount,
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
    <Card className="mb-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          ファイルアップロード
          {modelAnswerCount > 0 && (
            <Badge variant="secondary">
              模範解答: {modelAnswerCount}ページ
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div
          {...getRootProps()}
          className={`cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
            isDragActive
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-primary/50"
          } ${disabled || isConverting ? "cursor-not-allowed opacity-50" : ""}`}
        >
          <input {...getInputProps()} />

          {isConverting ? (
            <div className="space-y-4">
              <RefreshCw className="text-primary mx-auto h-12 w-12 animate-spin" />
              <div className="space-y-2">
                <p className="text-lg font-medium">ファイルを変換中...</p>
                <Progress
                  value={pdfProcessingProgress}
                  className="mx-auto w-full max-w-md"
                />
                <p className="text-muted-foreground text-sm">
                  {pdfProcessingProgress}% 完了
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <Upload className="text-muted-foreground mx-auto h-12 w-12" />
              <div className="space-y-2">
                <p className="text-lg font-medium">
                  {isDragActive
                    ? "ここにファイルをドロップしてください"
                    : "ファイルをドラッグ&ドロップまたはクリックしてアップロード"}
                </p>
                <p className="text-muted-foreground text-sm">
                  PDF、PNG、JPEG、TIFF、BMP ファイルに対応
                </p>
                {modelAnswerCount > 0 && (
                  <p className="text-xs text-blue-600">
                    ヒント: {modelAnswerCount}ページの模範解答が設定されています
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
