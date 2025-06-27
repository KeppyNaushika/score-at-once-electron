"use client"

import { useCallback, useState } from "react"
import { toast } from "sonner"
import { convertPdfToImages } from "@/lib/pdfConverter"
import { ConvertedFile } from "./types"

export function useFileProcessing() {
  const [files, setFiles] = useState<ConvertedFile[]>([])
  const [isConverting, setIsConverting] = useState(false)
  const [showPasswordDialog, setShowPasswordDialog] = useState(false)
  const [currentPdfFile, setCurrentPdfFile] = useState<File | null>(null)
  const [passwordError, setPasswordError] = useState<string>('')
  const [isPasswordProcessing, setIsPasswordProcessing] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])

  // ファイル変換処理
  const convertFilesToImages = useCallback(
    async (fileList: File[], password?: string): Promise<ConvertedFile[]> => {
      const convertedFiles: ConvertedFile[] = []
      
      for (const file of fileList) {
        try {
          if (file.type === "application/pdf") {
            const images = await convertPdfToImages(file, password)
            for (let i = 0; i < images.length; i++) {
              // プレビューURL作成
              const blob = new Blob([images[i].buffer], { type: "image/png" })
              const preview = URL.createObjectURL(blob)
              
              convertedFiles.push({
                id: `${file.name}-page-${i + 1}-${Date.now()}`,
                name: `${file.name} - ページ ${i + 1}`,
                type: "image/png",
                size: file.size,
                buffer: images[i].buffer,
                preview,
                pageNumber: i + 1,
                isSelected: true,
                originalFileName: file.name,
                pageLabel: `ページ ${i + 1}`,
              })
            }
          } else if (file.type.startsWith("image/")) {
            const buffer = await file.arrayBuffer()
            // プレビューURL作成
            const blob = new Blob([buffer], { type: file.type })
            const preview = URL.createObjectURL(blob)
            
            convertedFiles.push({
              id: `${file.name}-${Date.now()}`,
              name: file.name,
              type: file.type,
              size: file.size,
              buffer,
              preview,
              pageNumber: 1,
              isSelected: true,
              originalFileName: file.name,
            })
          }
        } catch (error: any) {
          // パスワード要求エラーは静かに再スロー
          if (error.message === 'password-required' || error.message === 'invalid-password') {
            throw error
          }
          // その他のエラーのみログ出力
          console.error(`ファイル変換エラー (${file.name}):`, error)
          throw error
        }
      }
      
      return convertedFiles
    },
    []
  )

  // ファイル処理
  const processFiles = useCallback(
    async (fileList: FileList | File[]) => {
      setIsConverting(true)
      try {
        const fileArray = Array.from(fileList)
        const processedFiles: ConvertedFile[] = []
        const passwordRequiredFiles: File[] = []

        // ファイルを個別に処理
        for (const file of fileArray) {
          try {
            if (file.type === "application/pdf") {
              // PDFファイルを試行（パスワードなし）
              const images = await convertFilesToImages([file])
              processedFiles.push(...images)
            } else {
              // 画像ファイルは直接処理
              const images = await convertFilesToImages([file])
              processedFiles.push(...images)
            }
          } catch (error: any) {
            // パスワード要求エラーの場合
            if (error.message === 'password-required') {
              passwordRequiredFiles.push(file)
            } else {
              console.error(`ファイル処理エラー (${file.name}):`, error)
              toast.error(`ファイル処理に失敗しました: ${file.name}`)
            }
          }
        }

        // 正常に処理されたファイルを追加
        if (processedFiles.length > 0) {
          setFiles(prev => [...prev, ...processedFiles])
          toast.success(`${processedFiles.length}個のファイルを処理しました`)
        }

        // パスワードが必要なファイルがある場合、最初のファイルのパスワード入力を促す
        if (passwordRequiredFiles.length > 0) {
          setPendingFiles(passwordRequiredFiles.slice(1)) // 2番目以降を保留
          setCurrentPdfFile(passwordRequiredFiles[0]) // 最初のファイルを設定
          setShowPasswordDialog(true)
          setPasswordError('')
        }
      } catch (error) {
        console.error("ファイル処理エラー:", error)
        toast.error("ファイル処理に失敗しました")
      } finally {
        setIsConverting(false)
      }
    },
    [convertFilesToImages]
  )

  return {
    files,
    setFiles,
    isConverting,
    showPasswordDialog,
    setShowPasswordDialog,
    currentPdfFile,
    setCurrentPdfFile,
    passwordError,
    setPasswordError,
    isPasswordProcessing,
    setIsPasswordProcessing,
    pendingFiles,
    setPendingFiles,
    processFiles,
    convertFilesToImages,
  }
}