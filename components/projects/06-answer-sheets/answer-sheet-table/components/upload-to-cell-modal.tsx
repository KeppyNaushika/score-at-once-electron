"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { convertPdfToImages } from "@/lib/pdfConverter"
import { FileImage, Lock, Upload } from "lucide-react"
import { useRef, useState } from "react"
import { toast } from "sonner"

interface UploadToCellModalProps {
  isOpen: boolean
  onClose: () => void
  onUpload: (file: File, pageNumber?: number) => void
  studentName?: string
  pageNumber?: number
}

interface ConvertedImage {
  name: string
  type: string
  size: number
  buffer: ArrayBuffer
  preview: string
}

export function UploadToCellModal({
  isOpen,
  onClose,
  onUpload,
  studentName,
  pageNumber,
}: UploadToCellModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [convertedImages, setConvertedImages] = useState<ConvertedImage[]>([])
  const [selectedImageIndex, setSelectedImageIndex] = useState<number>(0)
  const [isConverting, setIsConverting] = useState(false)
  const [pdfPassword, setPdfPassword] = useState("")
  const [showPasswordInput, setShowPasswordInput] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0]
    if (!file) return

    setSelectedFile(file)
    setConvertedImages([])
    setSelectedImageIndex(0)
    setShowPasswordInput(false)
    setPdfPassword("")

    if (file.type === "application/pdf") {
      await convertPdfFile(file)
    } else if (file.type.startsWith("image/")) {
      // 画像ファイルの場合は直接表示
      const preview = URL.createObjectURL(file)
      const buffer = await file.arrayBuffer()
      setConvertedImages([
        {
          name: file.name,
          type: file.type,
          size: file.size,
          buffer,
          preview,
        },
      ])
    }
  }

  const convertPdfFile = async (file: File, password?: string) => {
    setIsConverting(true)
    try {
      const images = await convertPdfToImages(file, password)
      const convertedImages: ConvertedImage[] = await Promise.all(
        images.map(async (image, index) => {
          const blob = new Blob([image.buffer], { type: "image/png" })
          const preview = URL.createObjectURL(blob)
          return {
            name: `${file.name}_page_${index + 1}.png`,
            type: "image/png",
            size: image.buffer.byteLength,
            buffer: image.buffer,
            preview,
          }
        }),
      )
      setConvertedImages(convertedImages)
      setShowPasswordInput(false)
    } catch (error) {
      if (error instanceof Error && error.message === "password-required") {
        setShowPasswordInput(true)
        toast.error("PDFファイルにパスワードが必要です")
      } else if (
        error instanceof Error &&
        error.message === "invalid-password"
      ) {
        toast.error("パスワードが正しくありません")
        setShowPasswordInput(true)
      } else {
        toast.error(
          `PDF変換エラー: ${error instanceof Error ? error.message : "不明なエラー"}`,
        )
      }
    } finally {
      setIsConverting(false)
    }
  }

  const handlePasswordSubmit = () => {
    if (selectedFile && pdfPassword.trim()) {
      convertPdfFile(selectedFile, pdfPassword.trim())
    }
  }

  const handleUpload = () => {
    if (!selectedFile || convertedImages.length === 0) return

    const selectedImage = convertedImages[selectedImageIndex]

    // FileオブジェクトとしてConvertedImageを変換
    const file = new File([selectedImage.buffer], selectedImage.name, {
      type: selectedImage.type,
    })

    onUpload(
      file,
      selectedFile.type === "application/pdf"
        ? selectedImageIndex + 1
        : undefined,
    )
    handleClose()
  }

  const handleClose = () => {
    setSelectedFile(null)
    setConvertedImages([])
    setSelectedImageIndex(0)
    setIsConverting(false)
    setPdfPassword("")
    setShowPasswordInput(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            セルに答案を追加
            {studentName && pageNumber && (
              <span className="ml-2 text-sm text-gray-500">
                ({studentName} - ページ{pageNumber})
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* ファイル選択 */}
          <div>
            <Label htmlFor="file-upload">答案ファイルを選択</Label>
            <Input
              ref={fileInputRef}
              id="file-upload"
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={handleFileSelect}
              className="mt-1"
            />
          </div>

          {/* パスワード入力 */}
          {showPasswordInput && (
            <div className="space-y-2">
              <Label htmlFor="pdf-password" className="flex items-center gap-2">
                <Lock className="h-4 w-4" />
                PDFパスワード
              </Label>
              <div className="flex gap-2">
                <Input
                  id="pdf-password"
                  type="password"
                  value={pdfPassword}
                  onChange={(e) => setPdfPassword(e.target.value)}
                  placeholder="PDFのパスワードを入力"
                  onKeyDown={(e) => e.key === "Enter" && handlePasswordSubmit()}
                />
                <Button
                  onClick={handlePasswordSubmit}
                  disabled={!pdfPassword.trim()}
                >
                  変換
                </Button>
              </div>
            </div>
          )}

          {/* 変換中 */}
          {isConverting && (
            <div className="flex items-center justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
              <span className="ml-2">PDF変換中...</span>
            </div>
          )}

          {/* 画像選択 */}
          {convertedImages.length > 0 && (
            <div className="space-y-3">
              <Label>
                {selectedFile?.type === "application/pdf"
                  ? "ページを選択"
                  : "選択された画像"}
                {convertedImages.length > 1 && (
                  <span className="ml-2 text-sm text-gray-500">
                    ({convertedImages.length}ページ)
                  </span>
                )}
              </Label>

              {convertedImages.length > 1 && (
                <div className="grid max-h-40 grid-cols-4 gap-2 overflow-y-auto">
                  {convertedImages.map((image, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedImageIndex(index)}
                      className={`relative aspect-square overflow-hidden rounded border-2 ${
                        selectedImageIndex === index
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <img
                        src={image.preview}
                        alt={`Page ${index + 1}`}
                        className="h-full w-full object-cover"
                      />
                      <div className="absolute right-0 bottom-0 left-0 bg-black/50 p-1 text-center text-xs text-white">
                        {index + 1}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* 選択された画像のプレビュー */}
              <div className="rounded-lg border bg-gray-50 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <FileImage className="h-5 w-5 text-gray-600" />
                  <span className="font-medium">
                    選択中: {convertedImages[selectedImageIndex]?.name}
                  </span>
                </div>
                <div className="max-h-64 overflow-auto">
                  <img
                    src={convertedImages[selectedImageIndex]?.preview}
                    alt="Selected image"
                    className="h-auto w-full rounded border"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            キャンセル
          </Button>
          <Button
            onClick={handleUpload}
            disabled={
              !selectedFile || convertedImages.length === 0 || isConverting
            }
            className="flex items-center gap-2"
          >
            <Upload className="h-4 w-4" />
            アップロード
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
