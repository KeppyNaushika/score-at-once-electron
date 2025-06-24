"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { RefreshCw, Upload } from "lucide-react"
import { useDropzone } from "react-dropzone"

interface FileUploadZoneProps {
  onDrop: (files: File[]) => void
  isConverting: boolean
  isClient: boolean
}

export default function FileUploadZone({ onDrop, isConverting, isClient }: FileUploadZoneProps) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".png", ".jpg", ".jpeg", ".tiff", ".bmp"],
      "application/pdf": [".pdf"],
    },
    multiple: true,
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>答案画像・PDFのアップロード</CardTitle>
        <CardDescription>
          試験の答案画像ファイルをドラッグ&ドロップまたはクリックして選択してください。
          <br />
          PDFは自動的にPNG画像に変換されます。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div
          {...getRootProps()}
          className={`cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
            isDragActive
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-muted-foreground/50"
          }`}
        >
          <input {...getInputProps()} />
          {isConverting ? (
            <div className="space-y-4">
              <RefreshCw className="text-primary mx-auto h-12 w-12 animate-spin" />
              <p className="text-lg">ファイルを変換中...</p>
            </div>
          ) : (
            <>
              <Upload className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
              {isDragActive ? (
                <p className="text-lg">
                  ファイルをドロップしてください...
                </p>
              ) : (
                <div>
                  <p className="mb-2 text-lg">
                    ファイルをドラッグ&ドロップするか、クリックして選択
                  </p>
                  <p className="text-muted-foreground text-sm">
                    PNG, JPEG{isClient ? ', PDF' : ''}
                    ファイルに対応{isClient ? '。PDFはページ別にPNG変換されます' : ''}。
                  </p>
                  {!isClient && (
                    <p className="text-yellow-600 text-xs mt-2">
                      PDF変換機能を読み込み中...
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}