"use client"

import { useCallback,useState } from "react"
import { toast } from "sonner"

export interface FileUploadOptions {
  accept?: string
  maxSize?: number
  allowMultiple?: boolean
  onProgress?: (progress: number) => void
  onSuccess?: (files: File[]) => void
  onError?: (error: Error) => void
}

export interface FileUploadState {
  isUploading: boolean
  progress: number
  error: string | null
}

export function useFileUpload(options: FileUploadOptions = {}) {
  const [state, setState] = useState<FileUploadState>({
    isUploading: false,
    progress: 0,
    error: null,
  })

  const validateFile = useCallback(
    (file: File): boolean => {
      const { maxSize = 10 * 1024 * 1024, accept } = options // Default 10MB

      if (file.size > maxSize) {
        const maxSizeMB = Math.round(maxSize / (1024 * 1024))
        throw new Error(
          `ファイルサイズが大きすぎます。${maxSizeMB}MB以下のファイルを選択してください。`
        )
      }

      if (accept) {
        const acceptedTypes = accept.split(",").map((type) => type.trim())
        const isAccepted = acceptedTypes.some((type) => {
          if (type.startsWith(".")) {
            return file.name.toLowerCase().endsWith(type.toLowerCase())
          }
          return file.type.match(type.replace(/\*/g, ".*"))
        })

        if (!isAccepted) {
          throw new Error(
            `サポートされていないファイル形式です。${accept}形式のファイルを選択してください。`
          )
        }
      }

      return true
    },
    [options]
  )

  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files)

      if (fileArray.length === 0) {
        return
      }

      if (!options.allowMultiple && fileArray.length > 1) {
        toast.error("複数のファイルは選択できません。")
        return
      }

      setState((prev) => ({
        ...prev,
        isUploading: true,
        progress: 0,
        error: null,
      }))

      try {
        // Validate all files first
        fileArray.forEach(validateFile)

        // Simulate progress for UI feedback
        const progressInterval = setInterval(() => {
          setState((prev) => ({
            ...prev,
            progress: Math.min(prev.progress + 10, 90),
          }))
        }, 100)

        // Process files
        await new Promise((resolve) => setTimeout(resolve, 500)) // Simulate processing time

        clearInterval(progressInterval)

        setState((prev) => ({
          ...prev,
          progress: 100,
          isUploading: false,
        }))

        options.onSuccess?.(fileArray)

        // Reset progress after success
        setTimeout(() => {
          setState((prev) => ({
            ...prev,
            progress: 0,
          }))
        }, 1000)
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : "ファイルのアップロードに失敗しました。"

        setState((prev) => ({
          ...prev,
          isUploading: false,
          progress: 0,
          error: errorMessage,
        }))

        options.onError?.(
          error instanceof Error ? error : new Error(errorMessage)
        )
        toast.error(errorMessage)
      }
    },
    [options, validateFile]
  )

  const resetState = useCallback(() => {
    setState({
      isUploading: false,
      progress: 0,
      error: null,
    })
  }, [])

  return {
    ...state,
    uploadFiles,
    resetState,
  }
}
