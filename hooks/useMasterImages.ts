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
    isMoving: false
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
    
    try {
      const allFilesData: ConvertedImage[] = []

      for (const file of files) {
        if (file.type === 'application/pdf') {
          // Convert PDF to individual page images
          const pdfImages = await convertPdfToImages(file)
          allFilesData.push(...pdfImages)
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
    }
  }, [projectId, onImagesChange, convertPdfToImages])

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
    moveImage
  }
}