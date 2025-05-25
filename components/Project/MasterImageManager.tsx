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
} from "lucide-react" // Loader2 をインポート
import { useCallback, useEffect, useState } from "react"
import { useDropzone } from "react-dropzone"
import { toast } from "sonner"

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
  const [isDeleting, setIsDeleting] = useState<Record<string, boolean>>({}) // 画像ごとの削除中状態
  const [isMoving, setIsMoving] = useState<boolean>(false) // いずれかの画像が移動中か

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
          console.log(
            `Resolved URL for ${image.id} (${image.path}): ${resolvedUrl}`,
          ) // デバッグログ追加
          urls[image.id] = resolvedUrl
        } catch (error) {
          console.error(
            `Failed to resolve path for image ${image.id} (${image.path}):`,
            error,
          )
          urls[image.id] = "" // エラー時は空文字列（またはnull/undefined）
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

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (!projectId) {
        toast.error("プロジェクトIDが指定されていません。")
        return
      }
      if (acceptedFiles && acceptedFiles.length > 0) {
        try {
          const fileDataPromises = acceptedFiles.map((file) => {
            return new Promise<{
              name: string
              type: string
              buffer: ArrayBuffer
              path?: string
            }>((resolve, reject) => {
              const reader = new FileReader()
              reader.onload = () => {
                resolve({
                  name: file.name,
                  type: file.type,
                  buffer: reader.result as ArrayBuffer,
                  path: (file as any).path,
                })
              }
              reader.onerror = (error) => {
                reject(error)
              }
              reader.readAsArrayBuffer(file)
            })
          })

          const filesToUpload = await Promise.all(fileDataPromises)

          if (filesToUpload.some((f) => !f.buffer)) {
            toast.error("ファイルの読み込みに失敗しました。")
            return
          }

          const newImageRecords = await window.electronAPI.uploadMasterImages(
            projectId,
            filesToUpload,
          )

          if (newImageRecords && newImageRecords.length > 0) {
            const updatedImages = [...masterImages, ...newImageRecords].sort(
              (a, b) => a.pageNumber - b.pageNumber,
            )
            setMasterImages(updatedImages)
            onMasterImagesChange(updatedImages)

            const newUrls: Record<string, string> = { ...imageDisplayUrls }
            for (const image of newImageRecords) {
              try {
                const resolvedUrl =
                  await window.electronAPI.resolveFileProtocolPath(image.path)
                console.log(
                  `Resolved URL for new image ${image.id} (${image.path}): ${resolvedUrl}`,
                ) // デバッグログ追加
                newUrls[image.id] = resolvedUrl
              } catch (error) {
                console.error(
                  `Failed to resolve path for new image ${image.id} (${image.path}):`,
                  error,
                )
                newUrls[image.id] = "" // エラー時は空文字列（またはnull/undefined）
              }
            }
            setImageDisplayUrls(newUrls)

            toast.success(
              `${newImageRecords.length}個の画像をアップロードしました。`,
            )
          } else {
            toast.info(
              "画像のアップロード処理後にレコードが返されませんでしたが、エラーはありませんでした。",
            )
          }
        } catch (error) {
          console.error("Failed to upload master images:", error)
          toast.error(
            `画像のアップロードに失敗しました: ${error instanceof Error ? error.message : String(error)}`,
          )
        }
      }
    },
    [projectId, masterImages, onMasterImagesChange, imageDisplayUrls],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/png": [".png"], "image/jpeg": [".jpg", ".jpeg"] },
    multiple: true,
  })

  const handleDeleteImage = async (imageId: string) => {
    if (
      !window.confirm(
        "この模範解答画像を削除しますか？実ファイルも削除されます。",
      )
    ) {
      return
    }
    setIsDeleting((prev) => ({ ...prev, [imageId]: true }))
    setIsMoving(true) // 他の操作を一時的にブロックする意図も込めて
    try {
      await window.electronAPI.deleteMasterImage(imageId)
      const remainingImages = masterImages.filter((img) => img.id !== imageId)
      const reorderedImages = remainingImages.map((img, index) => ({
        ...img,
        pageNumber: index + 1,
      }))

      setMasterImages(reorderedImages)
      onMasterImagesChange(reorderedImages)

      if (reorderedImages.length > 0) {
        const orderUpdates = reorderedImages.map((img) => ({
          id: img.id,
          pageNumber: img.pageNumber,
        }))
        await window.electronAPI.updateMasterImagesOrder(orderUpdates)
      }

      const newUrls = { ...imageDisplayUrls }
      delete newUrls[imageId]
      setImageDisplayUrls(newUrls)

      toast.success("画像を削除し、順序を更新しました。")
    } catch (error) {
      console.error("Failed to delete master image or update order:", error)
      toast.error(
        `画像の削除または順序更新に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
      )
    } finally {
      setIsDeleting((prev) => ({ ...prev, [imageId]: false }))
      setIsMoving(false)
    }
  }

  const handleMoveImage = async (
    index: number,
    direction: "left" | "right",
  ) => {
    setIsMoving(true)
    const newImages = [...masterImages]
    const imageToMove = newImages[index]
    const swapIndex = direction === "left" ? index - 1 : index + 1

    if (swapIndex < 0 || swapIndex >= newImages.length) {
      setIsMoving(false)
      return
    }

    newImages[index] = newImages[swapIndex]
    newImages[swapIndex] = imageToMove

    const updatedImagesWithPageNumbers = newImages.map((img, idx) => ({
      ...img,
      pageNumber: idx + 1,
    }))

    // UIを先に更新（オプティミスティックアップデートに近いが、API呼び出し前に状態変更）
    setMasterImages(updatedImagesWithPageNumbers)
    onMasterImagesChange(updatedImagesWithPageNumbers)

    try {
      const orderUpdates = updatedImagesWithPageNumbers.map((img) => ({
        id: img.id,
        pageNumber: img.pageNumber,
      }))
      await window.electronAPI.updateMasterImagesOrder(orderUpdates)

      toast.success("画像の表示順を変更し、保存しました。")
    } catch (error) {
      console.error("Failed to reorder master images:", error)
      toast.error(
        `画像の並び替えと保存に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
      )
      // エラーが発生した場合は、元の状態に戻す
      setMasterImages(masterImages)
      onMasterImagesChange(masterImages)
    } finally {
      setIsMoving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>模範解答画像管理</CardTitle>
      </CardHeader>
      <CardContent>
        <div
          {...getRootProps()}
          className={`mb-4 flex cursor-pointer justify-center rounded-md border-2 border-dashed px-6 pt-5 pb-6 ${isDragActive ? "border-primary bg-primary/10" : "border-gray-300 dark:border-gray-600"} ${isMoving ? "cursor-not-allowed opacity-50" : ""} transition-colors hover:border-gray-400 dark:hover:border-gray-500`}
        >
          <input {...getInputProps()} disabled={isMoving} />
          <div className="space-y-1 text-center">
            <UploadCloud
              className={`mx-auto h-10 w-10 ${isDragActive ? "text-primary" : "text-gray-400"}`}
            />
            <p className="text-sm text-gray-600 dark:text-gray-400">
              PNG/JPGファイルをここにドラッグ＆ドロップ、またはクリックして選択
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500">
              複数ページ対応
            </p>
          </div>
        </div>

        {masterImages && masterImages.length > 0 ? (
          <ScrollArea className="w-full rounded-md border whitespace-nowrap">
            <div className="flex space-x-4 p-4">
              {masterImages.map(
                (image: Prisma.MasterImageGetPayload<{}>, index) => {
                  const imageUrl = imageDisplayUrls[image.id]
                  const currentImageIsDeleting = isDeleting[image.id]
                  return imageUrl ? (
                    <div
                      key={image.id}
                      className="group relative w-40 shrink-0 overflow-hidden rounded-md"
                    >
                      <img
                        src={imageUrl}
                        alt={`模範解答 ${image.pageNumber}`}
                        className={`h-48 w-full object-cover ${currentImageIsDeleting || isMoving ? "opacity-50" : ""}`}
                        onError={(e) => {
                          e.currentTarget.src =
                            "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
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
        ) : (
          <p className="text-muted-foreground text-center text-sm">
            模範解答画像がアップロードされていません。
          </p>
        )}
      </CardContent>
    </Card>
  )
}
