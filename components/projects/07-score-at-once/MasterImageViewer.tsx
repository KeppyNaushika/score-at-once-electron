"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { MasterImageData } from "@/types/common.types"
import React, { useEffect, useState } from "react"

/**
 * MasterImageViewer - Displays master (reference) answer images in the scoring interface
 *
 * Features:
 * - Shows all master images sorted by page number
 * - Highlights the current question's corresponding master image
 * - Horizontal scrollable layout with thumbnails
 * - Asynchronous image loading with loading states
 * - Error handling for failed image loads
 */
interface MasterImageViewerProps {
  masterImages: MasterImageData[]
  currentQuestionMasterImageId?: string
  className?: string
}

const MasterImageViewer = React.memo(
  ({
    masterImages,
    currentQuestionMasterImageId,
    className,
  }: MasterImageViewerProps) => {
    const [imageUrls, setImageUrls] = useState<Record<string, string>>({})
    const [loadingImages, setLoadingImages] = useState<Set<string>>(new Set())

    // Load image URLs when master images change
    useEffect(() => {
      const loadImageUrls = async () => {
        if (!masterImages.length) return

        const newLoadingImages = new Set<string>()
        masterImages.forEach((image) => newLoadingImages.add(image.id))
        setLoadingImages(newLoadingImages)

        try {
          const urlPromises = masterImages.map(async (image) => {
            try {
              const url = await window.electronAPI.resolveFileProtocolPath(
                image.path,
              )
              return { id: image.id, url, success: true }
            } catch (error) {
              console.error(`Failed to load master image ${image.id}:`, error)
              return { id: image.id, url: null, success: false }
            }
          })

          const results = await Promise.all(urlPromises)
          const newImageUrls: Record<string, string> = {}

          results.forEach(({ id, url, success }) => {
            if (success && url) {
              newImageUrls[id] = url
            }
            setLoadingImages((prev) => {
              const newSet = new Set(prev)
              newSet.delete(id)
              return newSet
            })
          })

          setImageUrls((prev) => ({ ...prev, ...newImageUrls }))
        } catch (error) {
          console.error("Failed to load master image URLs:", error)
          setLoadingImages(new Set())
        }
      }

      loadImageUrls()
    }, [masterImages])

    if (!masterImages.length) {
      return null
    }

    // Sort images by page number
    const sortedImages = [...masterImages].sort(
      (a, b) => a.pageNumber - b.pageNumber,
    )

    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">
            模範解答 ({sortedImages.length}ページ)
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <ScrollArea className="w-full rounded-md border">
            <div className="flex space-x-3 p-3">
              {sortedImages.map((image) => {
                const imageUrl = imageUrls[image.id]
                const isLoading = loadingImages.has(image.id)
                const isCurrentQuestion =
                  image.id === currentQuestionMasterImageId

                return (
                  <div
                    key={image.id}
                    className={`relative flex h-32 w-24 shrink-0 overflow-hidden rounded-md border-2 ${
                      isCurrentQuestion
                        ? "border-blue-500 shadow-md"
                        : "border-gray-200"
                    }`}
                    title={`ページ ${image.pageNumber}${isCurrentQuestion ? " (現在の設問に対応)" : ""}`}
                  >
                    {imageUrl && !isLoading ? (
                      <>
                        <img
                          src={imageUrl}
                          alt={`ページ ${image.pageNumber}`}
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            e.currentTarget.alt = `画像読込エラー: ${image.path}`
                            console.error(
                              "Failed to load master image:",
                              image.path,
                              "using URL:",
                              imageUrl,
                            )
                          }}
                        />
                        <div className="absolute right-0 bottom-0 left-0 bg-black/70 px-1 py-0.5">
                          <p className="text-center text-xs font-medium text-white">
                            ページ {image.pageNumber}
                          </p>
                        </div>
                        {isCurrentQuestion && (
                          <div className="absolute top-1 right-1">
                            <div className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-white">
                              <span className="text-xs font-bold">●</span>
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gray-50">
                        {isLoading ? (
                          <div className="text-xs text-gray-500">読込中...</div>
                        ) : (
                          <div className="text-xs text-gray-400">画像なし</div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </CardContent>
      </Card>
    )
  },
)

MasterImageViewer.displayName = "MasterImageViewer"

export default MasterImageViewer
