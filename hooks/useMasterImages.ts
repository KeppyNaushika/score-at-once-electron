"use client"

import { useState, useCallback, useEffect } from "react"
import { Prisma } from "@prisma/client"
import { toast } from "sonner"
import { convertPdfToImages, ConvertedImage } from "@/lib/pdfConverter"

type MasterImage = Prisma.MasterImageGetPayload<{}>

export interface MasterImagesState {
  images: MasterImage[]
  imageUrls: Record<string, string>
  isUploading: boolean
  isDeleting: Record<string, boolean>
  isMoving: boolean
  passwordDialog: {
    isOpen: boolean
    fileName?: string
    attempts: number
    hasError: boolean
    isLoading: boolean
  }
}

export function useMasterImages(
  projectId: string,
  initialImages: MasterImage[],
  onImagesChange: (images: MasterImage[]) => void
) {
  const [state, setState] = useState<MasterImagesState>({
    images: [],
    imageUrls: {},
    isUploading: false,
    isDeleting: {},
    isMoving: false,
    passwordDialog: {
      isOpen: false,
      fileName: undefined,
      attempts: 0,
      hasError: false,
      isLoading: false
    }
  })


  // Initialize images and fetch URLs
  useEffect(() => {
    const sortedImages = [...initialImages].sort((a, b) => a.pageNumber - b.pageNumber)
    setState(prev => ({ ...prev, images: sortedImages }))

    const fetchUrls = async () => {
      const urls: Record<string, string> = {}
      for (const image of sortedImages) {
        try {
          const resolvedUrl = await window.electronAPI.resolveFileProtocolPath(image.path)
          urls[image.id] = resolvedUrl
        } catch (error) {
          console.error(`Failed to resolve path for image ${image.id} (${image.path}):`, error)
          urls[image.id] = ""
        }
      }
      setState(prev => ({ ...prev, imageUrls: urls }))
    }

    if (sortedImages.length > 0) {
      fetchUrls()
    } else {
      setState(prev => ({ ...prev, imageUrls: {} }))
    }
  }, [initialImages])

  // パスワード処理用の状態
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [currentFileIndex, setCurrentFileIndex] = useState(0)
  const [currentPassword, setCurrentPassword] = useState<string>("")

  const uploadImages = useCallback(async (files: File[]) => {
    if (!projectId) {
      toast.error("プロジェクトIDが指定されていません。")
      return
    }
    
    // クライアントサイドチェック
    if (typeof window === 'undefined') {
      toast.error("この機能はクライアントサイドでのみ利用可能です。")
      return
    }
    
    setState(prev => ({ ...prev, isUploading: true }))
    setPendingFiles(files)
    setCurrentFileIndex(0)
    
    try {
      const allFilesData: ConvertedImage[] = []

      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        setCurrentFileIndex(i)
        
        if (file.type === 'application/pdf') {
          try {
            // Convert PDF to individual page images with password handling
            const pdfImages = await convertPdfToImagesWithPassword(file)
            allFilesData.push(...pdfImages)
          } catch (error) {
            if (error instanceof Error && error.message === 'Password input cancelled') {
              // ユーザーがパスワード入力をキャンセルした場合
              return // アップロード処理を中断
            } else {
              throw error // その他のエラーは再投げ
            }
          }
        } else {
          // Handle regular image files
          const buffer = await file.arrayBuffer()
          allFilesData.push({
            name: file.name,
            type: file.type,
            buffer: buffer,
          })
        }
      }

      const result = await window.electronAPI.uploadMasterImages(projectId, allFilesData)
      
      if (result) {
        const totalPages = allFilesData.length
        const pdfCount = files.filter(f => f.type === 'application/pdf').length
        const imageCount = files.length - pdfCount
        
        let message = `${totalPages}枚の模範解答をアップロードしました`
        if (pdfCount > 0 && imageCount > 0) {
          message += ` (PDF ${pdfCount}ファイル, 画像 ${imageCount}ファイル)`
        } else if (pdfCount > 0) {
          message += ` (PDF ${pdfCount}ファイル)`
        }
        
        toast.success(message)
        
        // Get updated project data
        const updatedProject = await window.electronAPI.fetchProjectById(projectId)
        if (updatedProject && updatedProject.masterImages) {
          const sortedUpdatedImages = [...updatedProject.masterImages].sort(
            (a, b) => a.pageNumber - b.pageNumber
          )
          
          setState(prev => ({ ...prev, images: sortedUpdatedImages }))
          onImagesChange(sortedUpdatedImages)
          
          // Update image URLs
          const newUrls: Record<string, string> = {}
          for (const image of sortedUpdatedImages) {
            try {
              const resolvedUrl = await window.electronAPI.resolveFileProtocolPath(image.path)
              newUrls[image.id] = resolvedUrl
            } catch (error) {
              console.error(`Failed to resolve path for image ${image.id} (${image.path}):`, error)
              newUrls[image.id] = ""
            }
          }
          setState(prev => ({ ...prev, imageUrls: newUrls }))
        }
      }
    } catch (error) {
      console.error("Upload failed:", error)
      toast.error("ファイルのアップロードに失敗しました。")
    } finally {
      setState(prev => ({ ...prev, isUploading: false }))
      setPendingFiles([])
      setCurrentFileIndex(0)
      setCurrentPassword("")
    }
  }, [projectId, onImagesChange])

  // パスワード付きPDF変換処理
  const convertPdfToImagesWithPassword = useCallback(async (file: File): Promise<ConvertedImage[]> => {
    try {
      // まずパスワードなしで試行
      const pdfImages = await convertPdfToImages(file)
      return pdfImages
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (errorMessage === 'password-required' || errorMessage === 'invalid-password') {
        console.log('Password required, showing dialog for:', file.name)
        // パスワードが必要な場合、ダイアログを表示してPromiseを返す
        return new Promise((resolve, reject) => {
          const isInvalidPassword = errorMessage === 'invalid-password'
          
          console.log('Setting password dialog state')
          setState(prev => ({
            ...prev,
            passwordDialog: {
              isOpen: true,
              fileName: file.name,
              attempts: isInvalidPassword ? prev.passwordDialog.attempts + 1 : 0,
              hasError: isInvalidPassword,
              isLoading: false
            }
          }))
          
          // グローバルスコープで解決関数を保存
          ;(window as any).__masterImagePasswordResolve = resolve
          ;(window as any).__masterImagePasswordReject = reject
          ;(window as any).__masterImagePasswordFile = file
          console.log('Password dialog promise created and waiting...')
        })
      } else {
        // その他のエラーはそのまま投げる
        console.log('Other error, rethrowing:', error)
        throw error
      }
    }
  }, [])

  // パスワード送信処理
  const handlePasswordSubmit = useCallback(async (password: string) => {
    console.log('Password submit called with password:', password ? '[REDACTED]' : 'empty')
    const file = (window as any).__masterImagePasswordFile
    const resolve = (window as any).__masterImagePasswordResolve
    const reject = (window as any).__masterImagePasswordReject
    
    console.log('Global variables check:', { file: !!file, resolve: !!resolve, reject: !!reject })
    if (!file || !resolve || !reject) {
      console.log('Missing global variables, returning early')
      return
    }
    
    setState(prev => ({
      ...prev,
      passwordDialog: {
        ...prev.passwordDialog,
        isLoading: true,
        hasError: false
      }
    }))
    
    try {
      const pdfImages = await convertPdfToImages(file, password)
      
      // パスワード成功時の処理
      setState(prev => ({
        ...prev,
        passwordDialog: {
          isOpen: false,
          fileName: undefined,
          attempts: 0,
          hasError: false,
          isLoading: false
        }
      }))
      
      // グローバル変数をクリア
      ;(window as any).__masterImagePasswordResolve = null
      ;(window as any).__masterImagePasswordReject = null
      ;(window as any).__masterImagePasswordFile = null
      
      resolve(pdfImages)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (errorMessage === 'invalid-password') {
        setState(prev => ({
          ...prev,
          passwordDialog: {
            ...prev.passwordDialog,
            isLoading: false,
            hasError: true,
            attempts: prev.passwordDialog.attempts + 1
          }
        }))
      } else {
        setState(prev => ({
          ...prev,
          passwordDialog: {
            isOpen: false,
            fileName: undefined,
            attempts: 0,
            hasError: false,
            isLoading: false
          }
        }))
        
        // グローバル変数をクリア
        ;(window as any).__masterImagePasswordResolve = null
        ;(window as any).__masterImagePasswordReject = null
        ;(window as any).__masterImagePasswordFile = null
        
        reject(error)
      }
    }
  }, [])

  // パスワードダイアログを閉じる
  const handlePasswordCancel = useCallback(() => {
    const reject = (window as any).__masterImagePasswordReject
    
    setState(prev => ({
      ...prev,
      passwordDialog: {
        isOpen: false,
        fileName: undefined,
        attempts: 0,
        hasError: false,
        isLoading: false
      },
      isUploading: false
    }))
    
    // グローバル変数をクリア
    ;(window as any).__masterImagePasswordResolve = null
    ;(window as any).__masterImagePasswordReject = null
    ;(window as any).__masterImagePasswordFile = null
    
    // Promise を拒否
    if (reject) {
      reject(new Error('Password input cancelled'))
    }
    
    setPendingFiles([])
    setCurrentFileIndex(0)
    setCurrentPassword("")
  }, [])

  const deleteImage = useCallback(async (imageId: string) => {
    setState(prev => ({
      ...prev,
      isDeleting: { ...prev.isDeleting, [imageId]: true }
    }))

    try {
      await window.electronAPI.deleteMasterImage(imageId)
      const updatedImages = state.images.filter((img) => img.id !== imageId)
      
      setState(prev => ({
        ...prev,
        images: updatedImages,
        isDeleting: { ...prev.isDeleting, [imageId]: false },
        imageUrls: Object.fromEntries(
          Object.entries(prev.imageUrls).filter(([id]) => id !== imageId)
        )
      }))
      
      onImagesChange(updatedImages)
      toast.success("画像を削除しました。")
    } catch (error) {
      console.error("Failed to delete image:", error)
      toast.error("画像の削除に失敗しました。")
      setState(prev => ({
        ...prev,
        isDeleting: { ...prev.isDeleting, [imageId]: false }
      }))
    }
  }, [state.images, onImagesChange])

  const moveImage = useCallback(async (fromIndex: number, direction: "left" | "right") => {
    const toIndex = direction === "left" ? fromIndex - 1 : fromIndex + 1
    if (toIndex < 0 || toIndex >= state.images.length) return

    setState(prev => ({ ...prev, isMoving: true }))

    try {
      const newImages = [...state.images]
      const [movedImage] = newImages.splice(fromIndex, 1)
      newImages.splice(toIndex, 0, movedImage)

      const updateRequests = newImages.map((image, index) => ({
        id: image.id,
        pageNumber: index + 1,
      }))

      await window.electronAPI.updateMasterImagesOrder(updateRequests)

      setState(prev => ({ ...prev, images: newImages }))
      onImagesChange(newImages)
    } catch (error) {
      console.error("Failed to move image:", error)
      toast.error("画像の移動に失敗しました。")
    } finally {
      setState(prev => ({ ...prev, isMoving: false }))
    }
  }, [state.images, onImagesChange])

  return {
    ...state,
    uploadImages,
    deleteImage,
    moveImage,
    handlePasswordSubmit,
    handlePasswordCancel
  }
}