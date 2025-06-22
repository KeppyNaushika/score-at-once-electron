"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { Prisma } from "@prisma/client"
import {
  ArrowLeft,
  ArrowRight,
  Trash2,
  UploadCloud,
  Loader2,
} from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { useDropzone } from "react-dropzone"
import { toast } from "sonner"
import * as pdfjsLib from 'pdfjs-dist'

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`

interface MasterImageManagerProps {
  projectId: string
  initialMasterImages: Prisma.MasterImageGetPayload<{}>[]
  onMasterImagesChange: (images: Prisma.MasterImageGetPayload<{}>[]) => void
}

export default function MasterImageManager({
  projectId,
  initialMasterImages,
  onMasterImagesChange,
}: MasterImageManagerProps) {
  const [masterImages, setMasterImages] =
    useState<Prisma.MasterImageGetPayload<{}>[]>(initialMasterImages)
  const [imageDisplayUrls, setImageDisplayUrls] = useState<
    Record<string, string>
  >({})
  const [isDeleting, setIsDeleting] = useState<Record<string, boolean>>({})
  const [isMoving, setIsMoving] = useState<boolean>(false)
  const [isUploading, setIsUploading] = useState<boolean>(false)

  useEffect(() => {
    const sortedInitialImages = [...initialMasterImages].sort(
      (a, b) => a.pageNumber - b.pageNumber,
    )
    setMasterImages(sortedInitialImages)

    const fetchUrls = async () => {
      const urls: Record<string, string> = {}
      for (const image of sortedInitialImages) {
        try {
          const resolvedUrl = await window.electronAPI.resolveFileProtocolPath(
            image.path,
          )
          urls[image.id] = resolvedUrl
        } catch (error) {
          console.error(
            `Failed to resolve path for image ${image.id} (${image.path}):`,
            error,
          )
          urls[image.id] = ""
        }
      }
      setImageDisplayUrls(urls)
    }
    if (sortedInitialImages.length > 0) {
      fetchUrls()
    } else {
      setImageDisplayUrls({})
    }
  }, [initialMasterImages])

  const convertPdfToImages = async (file: File): Promise<Array<{ name: string; type: string; buffer: ArrayBuffer }>> => {
    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument(arrayBuffer).promise
    const images: Array<{ name: string; type: string; buffer: ArrayBuffer }> = []

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum)
      const scale = 2.0 // Higher scale for better quality
      const viewport = page.getViewport({ scale })

      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')!
      canvas.height = viewport.height
      canvas.width = viewport.width

      await page.render({
        canvasContext: context,
        viewport: viewport
      }).promise

      // Convert canvas to blob with PNG for lossless quality (better for editing workflow)
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((blob) => resolve(blob!), 'image/png')
      })

      const buffer = await blob.arrayBuffer()
      const baseName = file.name.replace(/\.pdf$/i, '')
      
      images.push({
        name: `${baseName}_page_${pageNum}.png`,
        type: 'image/png',
        buffer: buffer
      })
    }

    return images
  }

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (!projectId) {
        toast.error("プロジェクトIDが指定されていません。")
        return
      }
      
      setIsUploading(true)
      
      try {
        const allFilesData: Array<{ name: string; type: string; buffer: ArrayBuffer }> = []

        for (const file of acceptedFiles) {
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

        const result = await window.electronAPI.uploadMasterImages(
          projectId,
          allFilesData,
        )
        
        if (result) {
          const totalPages = allFilesData.length
          const pdfCount = acceptedFiles.filter(f => f.type === 'application/pdf').length
          const imageCount = acceptedFiles.length - pdfCount
          
          let message = `${totalPages}枚の模範解答をアップロードしました`
          if (pdfCount > 0 && imageCount > 0) {
            message += ` (PDF ${pdfCount}ファイル, 画像 ${imageCount}ファイル)`
          } else if (pdfCount > 0) {
            message += ` (PDF ${pdfCount}ファイル)`
          }
          
          toast.success(message)
          
          // アップロード成功時に最新のマスター画像リストを取得してUIを更新
          const updatedProject =
            await window.electronAPI.fetchProjectById(projectId)
          if (updatedProject && updatedProject.masterImages) {
            const sortedUpdatedImages = [
              ...updatedProject.masterImages,
            ].sort((a, b) => a.pageNumber - b.pageNumber)
            setMasterImages(sortedUpdatedImages)
            onMasterImagesChange(sortedUpdatedImages)
            
            // Update image URLs
            const newUrls: Record<string, string> = {}
            for (const image of sortedUpdatedImages) {
              try {
                const resolvedUrl =
                  await window.electronAPI.resolveFileProtocolPath(image.path)
                newUrls[image.id] = resolvedUrl
              } catch (error) {
                console.error(
                  `Failed to resolve path for image ${image.id} (${image.path}):`,
                  error,
                )
                newUrls[image.id] = ""
              }
            }
            setImageDisplayUrls(newUrls)
          }
        }
      } catch (error) {
        console.error("Upload failed:", error)
        toast.error("ファイルのアップロードに失敗しました。")
      } finally {
        setIsUploading(false)
      }
    },
    [projectId, onMasterImagesChange],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".png", ".jpg", ".jpeg", ".gif", ".bmp", ".tiff"],
      "application/pdf": [".pdf"]
    },
    multiple: true,
    disabled: isUploading
  })

  const handleDeleteImage = async (imageId: string) => {
    setIsDeleting((prev) => ({ ...prev, [imageId]: true }))

    try {
      await window.electronAPI.deleteMasterImage(imageId)
      const updatedImages = masterImages.filter((img) => img.id !== imageId)
      setMasterImages(updatedImages)
      onMasterImagesChange(updatedImages)

      const { [imageId]: deletedUrl, ...restUrls } = imageDisplayUrls
      setImageDisplayUrls(restUrls)

      toast.success("画像を削除しました。")
    } catch (error) {
      console.error("Failed to delete image:", error)
      toast.error("画像の削除に失敗しました。")
    } finally {
      setIsDeleting((prev) => ({ ...prev, [imageId]: false }))
    }
  }

  const handleMoveImage = async (
    fromIndex: number,
    direction: "left" | "right",
  ) => {
    const toIndex = direction === "left" ? fromIndex - 1 : fromIndex + 1
    if (toIndex < 0 || toIndex >= masterImages.length) return

    setIsMoving(true)

    try {
      const newMasterImages = [...masterImages]
      const [movedImage] = newMasterImages.splice(fromIndex, 1)
      newMasterImages.splice(toIndex, 0, movedImage)

      const updateRequests = newMasterImages.map((image, index) => ({
        id: image.id,
        pageNumber: index + 1,
      }))

      await window.electronAPI.updateMasterImagesOrder(updateRequests)

      setMasterImages(masterImages)
      onMasterImagesChange(masterImages)
    } finally {
      setIsMoving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-all cursor-pointer ${
          isDragActive
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-primary/50"
        } ${isUploading ? "cursor-not-allowed opacity-50" : ""}`}
      >
        <input {...getInputProps()} disabled={isUploading} />
        <div className="mx-auto flex max-w-[420px] flex-col items-center justify-center text-center">
          {isUploading ? (
            <div>
              <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
              <h3 className="mt-4 text-lg font-semibold">アップロード中...</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                PDFの変換処理を含む場合、時間がかかることがあります
              </p>
            </div>
          ) : (
            <>
              <UploadCloud className="mx-auto h-10 w-10 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">
                ファイルをドロップまたはクリックして選択
              </h3>
              <p className="mb-4 mt-2 text-sm text-muted-foreground">
                PDF または画像ファイル (PNG, JPG) をアップロードできます
              </p>
              <p className="text-xs text-muted-foreground">
                PDF の場合、各ページが自動的に画像として分割されます
              </p>
            </>
          )}
        </div>
      </div>

      {/* Image Gallery */}
      {masterImages.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>模範解答 ({masterImages.length}ページ)</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="w-full rounded-md border whitespace-nowrap">
              <div className="flex space-x-4 p-4">
              {masterImages.map(
                (image: Prisma.MasterImageGetPayload<{}>, index) => {
                  const imageUrl = imageDisplayUrls[image.id]
                  const currentImageIsDeleting = isDeleting[image.id]

                  return imageUrl ? (
                    <div
                      key={image.id}
                      className="group relative flex h-48 w-40 shrink-0 overflow-hidden rounded-md border"
                    >
                      <img
                        src={imageUrl}
                        alt={`ページ ${image.pageNumber}`}
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          e.currentTarget.alt = `画像読込エラー: ${image.path}`
                          console.error(
                            "Failed to load image:",
                            image.path,
                            "using URL:",
                            imageUrl,
                          )
                        }}
                      />
                      {(currentImageIsDeleting ||
                        (isMoving && !currentImageIsDeleting)) && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                          <Loader2 className="h-8 w-8 animate-spin text-white" />
                        </div>
                      )}
                      <div
                        className={`absolute inset-0 flex flex-col items-center justify-center bg-black/50 ${currentImageIsDeleting || isMoving ? "opacity-0" : "opacity-0 transition-opacity group-hover:opacity-100"}`}
                      >
                        <p className="text-sm font-semibold text-white">
                          ページ {image.pageNumber}
                        </p>
                        <div className="mt-2 flex space-x-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-white hover:bg-white/20"
                            onClick={() => handleMoveImage(index, "left")}
                            disabled={
                              index === 0 || currentImageIsDeleting || isMoving
                            }
                            title="左へ移動"
                          >
                            <ArrowLeft className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="destructive"
                            className="h-7 w-7"
                            onClick={() => handleDeleteImage(image.id)}
                            disabled={currentImageIsDeleting || isMoving}
                            title="削除"
                          >
                            {currentImageIsDeleting ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-white hover:bg-white/20"
                            onClick={() => handleMoveImage(index, "right")}
                            disabled={
                              index === masterImages.length - 1 ||
                              currentImageIsDeleting ||
                              isMoving
                            }
                            title="右へ移動"
                          >
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div
                      key={image.id}
                      className="group relative flex h-48 w-40 shrink-0 items-center justify-center overflow-hidden rounded-md border"
                    >
                      <p className="text-muted-foreground text-xs">
                        画像準備中...
                      </p>
                    </div>
                  )
                },
              )}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  )
}