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
              convertedFiles.push({
                id: `${file.name}-page-${i + 1}-${Date.now()}`,
                name: `${file.name} - ページ ${i + 1}`,
                type: "image/png",
                size: file.size,
                buffer: images[i].buffer,
                pageNumber: i + 1,
                isSelected: true,
                originalFileName: file.name,
                pageLabel: `ページ ${i + 1}`,
              })
            }
          } else if (file.type.startsWith("image/")) {
            const buffer = await file.arrayBuffer()
            convertedFiles.push({
              id: `${file.name}-${Date.now()}`,
              name: file.name,
              type: file.type,
              size: file.size,
              buffer,
              pageNumber: 1,
              isSelected: true,
              originalFileName: file.name,
            })
          }
        } catch (error) {
          console.error(`ファイル変換エラー (${file.name}):`, error)
          toast.error(`ファイル変換に失敗しました: ${file.name}`)
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
        const newFiles = await convertFilesToImages(fileArray)
        setFiles(prev => [...prev, ...newFiles])
        toast.success(`${newFiles.length}個のファイルを処理しました`)
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