"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { MasterAnswerData } from "@/types/common.types"
import Image from "next/image"
import React, { useEffect, useState } from "react"

/**
 * MasterAnswerViewer - Displays master (reference) answer images in the scoring interface
 *
 * Features:
 * - Shows all master answer images sorted by page number
 * - Highlights the current question's corresponding master answer image
 * - Horizontal scrollable layout with thumbnails
 * - Asynchronous image loading with loading states
 * - Error handling for failed image loads
 */
interface MasterAnswerViewerProps {
  masterAnswers: MasterAnswerData[]
  currentQuestionMasterAnswerId?: string
  className?: string
}

const MasterAnswerViewer = React.memo(
  ({
    masterAnswers,
    currentQuestionMasterAnswerId,
    className,
  }: MasterAnswerViewerProps) => {
    const [imageUrls, setImageUrls] = useState<Record<string, string>>({})
    const [loadingImages, setLoadingImages] = useState<Set<string>>(new Set())

    // Load image URLs when master answers change
    useEffect(() => {
      const loadImageUrls = async () => {
        if (!masterAnswers.length) return

        const newLoadingImages = new Set<string>()
        masterAnswers.forEach((answer) => newLoadingImages.add(answer.id))
        setLoadingImages(newLoadingImages)

        try {
          const urlPromises = masterAnswers.map(async (answer) => {
            try {
              const url = await window.electronAPI.resolveFileProtocolPath(
                answer.imagePath,
              )
              return { id: answer.id, url, success: true }
            } catch (error) {
              console.error(`Failed to load master answer ${answer.id}:`, error)
              return { id: answer.id, url: null, success: false }
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
          console.error("Failed to load master answer URLs:", error)
          setLoadingImages(new Set())
        }
      }

      loadImageUrls()
    }, [masterAnswers])

    if (!masterAnswers.length) {
      return null
    }

    // Sort answers by page number
    const sortedAnswers = [...masterAnswers].sort(
      (a, b) => a.pageNumber - b.pageNumber,
    )

    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">
            模範解答 ({sortedAnswers.length}ページ)
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <ScrollArea className="w-full rounded-md border">
            <div className="flex space-x-3 p-3">
              {sortedAnswers.map((answer) => {
                const imageUrl = imageUrls[answer.id]
                const isLoading = loadingImages.has(answer.id)
                const isCurrentQuestion =
                  answer.id === currentQuestionMasterAnswerId

                return (
                  <div
                    key={answer.id}
                    className={`relative flex h-32 w-24 shrink-0 overflow-hidden rounded-md border-2 ${
                      isCurrentQuestion
                        ? "border-blue-500 shadow-md"
                        : "border-gray-200"
                    }`}
                    title={`ページ ${answer.pageNumber}${isCurrentQuestion ? " (現在の設問に対応)" : ""}`}
                  >
                    {imageUrl && !isLoading ? (
                      <>
                        <Image
                          src={imageUrl}
                          alt={`ページ ${answer.pageNumber}`}
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            e.currentTarget.alt = `画像読込エラー: ${answer.imagePath}`
                            console.error(
                              "Failed to load master answer:",
                              answer.imagePath,
                              "using URL:",
                              imageUrl,
                            )
                          }}
                          width={96}
                          height={128}
                          unoptimized
                        />
                        <div className="absolute right-0 bottom-0 left-0 bg-black/70 px-1 py-0.5">
                          <p className="text-center text-xs font-medium text-white">
                            ページ {answer.pageNumber}
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

MasterAnswerViewer.displayName = "MasterAnswerViewer"

export default MasterAnswerViewer
