"use client"

import { RefreshCw, Upload } from "lucide-react"
import { useDropzone } from "react-dropzone"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import type { FileUploadZoneProps } from "@/components/projects/05-answer-sheets/answer-sheet-management/types"

export function FileUploadZone({
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
    <Card className="mb-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          ファイルアップロード
          {masterImageCount > 0 && (
            <Badge variant="secondary">
              模範解答: {masterImageCount}ページ
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer
            ${isDragActive 
              ? "border-primary bg-primary/5" 
              : "border-muted-foreground/25 hover:border-primary/50"
            }
            ${(disabled || isConverting) 
              ? "opacity-50 cursor-not-allowed" 
              : ""
            }`}
        >
          <input {...getInputProps()} />
          
          {isConverting ? (
            <div className="space-y-4">
              <RefreshCw className="h-12 w-12 text-primary mx-auto animate-spin" />
              <div className="space-y-2">
                <p className="text-lg font-medium">ファイルを変換中...</p>
                <Progress value={pdfProcessingProgress} className="w-full max-w-md mx-auto" />
                <p className="text-sm text-muted-foreground">
                  {pdfProcessingProgress}% 完了
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <Upload className="h-12 w-12 text-muted-foreground mx-auto" />
              <div className="space-y-2">
                <p className="text-lg font-medium">
                  {isDragActive 
                    ? "ここにファイルをドロップしてください" 
                    : "ファイルをドラッグ&ドロップまたはクリックしてアップロード"
                  }
                </p>
                <p className="text-sm text-muted-foreground">
                  PDF、PNG、JPEG、TIFF、BMP ファイルに対応
                </p>
                {masterImageCount > 0 && (
                  <p className="text-xs text-blue-600">
                    ヒント: {masterImageCount}ページの模範解答が設定されています
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