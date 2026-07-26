"use client"

import { fromEvent } from "file-selector"
import { COMMON_MIME_TYPES } from "file-selector/mime"
import { RefreshCw, Upload } from "lucide-react"
import { useDropzone } from "react-dropzone"

import type { FileUploadZoneProps } from "@/components/exams/06-student-answers/student-answer-management/types"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"

/**
 * 拡張子から MIME を補完してから File を渡す。
 *
 * file-selector v4 で拡張子→MIME の変換表が既定の同梱から外れたため、明示的に
 * COMMON_MIME_TYPES を渡して従来の網羅性を保つ。ドロップの受理自体は accept に
 * 拡張子を列挙しているので変換表が無くても通るが、変換後の `useStudentAnswerUpload`
 * が `file.type === "application/pdf"` で PDF 変換の要否を分岐しているため、
 * type が空だと PDF が画像として扱われて静かに壊れる。
 */
const getFilesFromEventWithMimeTypes = (
  event: Parameters<typeof fromEvent>[0]
) => fromEvent(event, { mimeTypes: COMMON_MIME_TYPES })

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
    getFilesFromEvent: getFilesFromEventWithMimeTypes,
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
