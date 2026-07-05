"use client"

import { ExamPage, User } from "@prisma/client"
import Image from "next/image"
import { useParams, useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import RegionDetailsTable from "@/components/exams/03-region-info/components/RegionDetailsTable"
import { useOmrConfig } from "@/components/exams/03-region-info/hooks/useOmrConfig"
import { usePageHelp } from "@/components/help/usePageHelp"
import PageHeader from "@/components/layout/PageHeader"
import { Button } from "@/components/ui/button"
import type { CropRegionWithSubtotals } from "@/electron-src/lib/prisma/cropRegion"

export default function RegionInfoPage() {
  const params = useParams()
  const router = useRouter()
  const { helpButton } = usePageHelp()

  const paramsExamId = params.examId
  const examId =
    typeof paramsExamId === "string" ? paramsExamId : paramsExamId?.[0]

  const [saveTimeoutId, setSaveTimeoutId] = useState<NodeJS.Timeout | null>(
    null
  )
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [cropRegions, setCropRegions] = useState<CropRegionWithSubtotals[]>([])

  const [examPages, setExamPages] = useState<ExamPage[]>([])
  const [selectedExamPage, setSelectedExamPage] = useState<ExamPage | null>(
    null
  )
  const [backgroundImageUrls, setBackgroundImageUrls] = useState<{
    [key: string]: string
  }>({})

  const [isLoading, setIsLoading] = useState(true)

  // OMR設定管理
  const { getOmrConfig, upsertOmrConfig, deleteOmrConfig } = useOmrConfig(
    examId ?? ""
  )

  const loadInitialData = useCallback(async () => {
    if (!examId) {
      toast.error("試験IDが見つかりません。")
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    try {
      const user = await window.electronAPI.getCurrentUser()
      setCurrentUser(user)

      const fetchedExam = await window.electronAPI.fetchExamById(examId)
      if (fetchedExam) {
        if (fetchedExam.examPages && fetchedExam.examPages.length > 0) {
          const sortedExamPages = [...fetchedExam.examPages].sort(
            (pageA, pageB) => pageA.pageNumber - pageB.pageNumber
          )
          setExamPages(sortedExamPages)
          setSelectedExamPage(sortedExamPages[0])

          // 全ページの画像URLを取得
          const urls: { [key: string]: string } = {}
          for (const page of sortedExamPages) {
            const masterImage = page.masterImages?.[0]
            if (masterImage) {
              const url = await window.electronAPI.resolveFileProtocolPath(
                masterImage.imagePath
              )
              urls[page.id] = url
            }
          }
          setBackgroundImageUrls(urls)
        } else {
          setExamPages([])
          setSelectedExamPage(null)
          setBackgroundImageUrls({})
        }

        // 既存の作物領域を取得
        try {
          const existingRegions =
            await window.electronAPI.getCropRegionsByExamId(examId)
          if (existingRegions && existingRegions.length > 0) {
            setCropRegions(existingRegions)
          } else {
            setCropRegions([])
          }
        } catch (regionError) {
          console.error("Failed to load crop regions:", regionError)
          setCropRegions([])
        }
      } else {
        toast.error("試験が見つかりません。")
        setExamPages([])
        setSelectedExamPage(null)
        setBackgroundImageUrls({})
        setCropRegions([])
      }
    } catch (error) {
      console.error("Failed to load initial data:", error)
      toast.error("初期データの読み込みに失敗しました。")
    } finally {
      setIsLoading(false)
    }
  }, [examId])

  useEffect(() => {
    loadInitialData()
  }, [loadInitialData])

  const autoSaveRegions = useCallback(
    async (regions: CropRegionWithSubtotals[]) => {
      if (!examId || !currentUser) return

      try {
        const savePromises = regions.map(async (area) => {
          if (!area.examPage?.id) return null

          const regionData = {
            examPageId: area.examPage.id,
            type: area.type,
            x: area.x,
            y: area.y,
            width: area.width,
            height: area.height,
            label: area.label,
            points: area.points,
            orderIndex: area.orderIndex,
          }

          if (area.id) {
            return await window.electronAPI.updateCropRegion(
              area.id,
              regionData
            )
          } else {
            const { orderIndex: _ignoredOrderIndex, ...createData } = regionData
            return await window.electronAPI.createCropRegion(createData)
          }
        })

        const savedRegions = await Promise.all(savePromises.filter(Boolean))

        if (savedRegions.length > 0) {
          setCropRegions(
            savedRegions.filter(
              (
                region: CropRegionWithSubtotals | null
              ): region is CropRegionWithSubtotals => region !== null
            )
          )
        }
      } catch (error) {
        console.error("Auto-save failed:", error)
      }
    },
    [examId, currentUser]
  )

  const handleRegionsChange = useCallback(
    (
      newRegions:
        | CropRegionWithSubtotals[]
        | ((prev: CropRegionWithSubtotals[]) => CropRegionWithSubtotals[])
    ) => {
      const updatedRegions =
        typeof newRegions === "function" ? newRegions(cropRegions) : newRegions

      setCropRegions(updatedRegions)

      // Clear existing timeout
      if (saveTimeoutId) {
        clearTimeout(saveTimeoutId)
      }

      // Set new timeout for auto-save
      const timeoutId = setTimeout(() => {
        autoSaveRegions(updatedRegions)
      }, 1000) // Auto-save after 1 second of inactivity

      setSaveTimeoutId(timeoutId)
    },
    [saveTimeoutId, autoSaveRegions, cropRegions]
  )

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p>領域情報を読み込み中...</p>
      </div>
    )
  }
  if (!examId) {
    return (
      <div className="flex h-full items-center justify-center">
        <p>試験情報がありません。</p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader title="採点領域の詳細情報設定" helpButton={helpButton}>
        <Button
          onClick={() => router.push(`/exams/${examId}/04-question-group`)}
        >
          次へ: 小計点の設定
        </Button>
      </PageHeader>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: All Pages Preview */}
        <div
          className="flex flex-col border-r"
          style={{ width: "400px", maxWidth: "33.333%" }}
        >
          <div className="flex-1 overflow-y-auto p-4">
            <h3 className="mb-3 font-medium">模範解答 (全ページ)</h3>
            <div className="space-y-4">
              {examPages.map((page) => {
                const displayPageNumber = page.pageNumber
                const imageUrl = backgroundImageUrls[page.id]
                const pageRegions = cropRegions.filter(
                  (region) => region.examPage?.id === page.id
                )

                return (
                  <div key={page.id} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-medium">
                        ページ {displayPageNumber}
                      </h4>
                      <div className="text-muted-foreground text-xs">
                        ({pageRegions.length}個の領域)
                      </div>
                    </div>

                    {imageUrl ? (
                      <div className="relative overflow-hidden rounded-lg border">
                        <Image
                          src={imageUrl}
                          alt={`模範解答 ページ ${displayPageNumber}`}
                          className="w-full cursor-pointer object-contain transition-opacity hover:opacity-75"
                          width={800}
                          height={600}
                          unoptimized
                          onClick={() => {
                            setSelectedExamPage(page)
                          }}
                        />
                        {pageRegions.map((area, index) => {
                          const globalIndex = cropRegions.findIndex(
                            (region) => region.id === area.id
                          )
                          const isSelected = selectedRowIndex === globalIndex
                          return (
                            <div
                              key={area.id ?? `area-${page.id}-${index}`}
                              className={`absolute border-2 ${
                                isSelected
                                  ? "border-orange-500 bg-orange-500/30"
                                  : "border-blue-500 bg-blue-500/20"
                              }`}
                              style={{
                                left: `${area.x * 100}%`,
                                top: `${area.y * 100}%`,
                                width: `${area.width * 100}%`,
                                height: `${area.height * 100}%`,
                              }}
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedRowIndex(globalIndex)
                              }}
                            />
                          )
                        })}
                        {selectedExamPage?.id === page.id && (
                          <div className="absolute top-2 left-2 rounded bg-blue-500 px-2 py-1 text-xs font-medium text-white">
                            編集中
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="relative flex aspect-3/4 items-center justify-center overflow-hidden rounded-lg border bg-gray-100">
                        <div className="text-muted-foreground text-sm">
                          画像が見つかりません
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
          {/* フッター統計 */}
          <div className="text-muted-foreground flex justify-between border-t p-2 text-xs">
            <span>{cropRegions.length}個の領域</span>
            <span>
              合計{" "}
              {cropRegions
                .filter((region) => region.type === "QUESTION_ANSWER")
                .reduce((sum, region) => sum + (region.points ?? 0), 0)}
              点
            </span>
          </div>
        </div>

        {/* Right: Region Details Table */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="shrink-0 p-4 pb-0">
            <div className="mb-4">
              <h3 className="text-lg font-medium">
                領域情報テーブル（全ページ統一順序）
              </h3>
              <p className="text-muted-foreground text-sm">
                全ページ {cropRegions.length}個の領域を統一順序で表示
                {selectedExamPage && (
                  <span className="ml-2 text-blue-600">
                    ※ ページ {selectedExamPage.pageNumber} を選択中
                  </span>
                )}
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                各行をクリックして選択し、種類・ラベル・配点などを設定してください。ドラッグ&ドロップで順序を変更できます。
              </p>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            <RegionDetailsTable
              regions={cropRegions}
              setRegions={handleRegionsChange}
              selectedRowIndex={selectedRowIndex}
              setSelectedRowIndex={setSelectedRowIndex}
              selectedMasterImageId={selectedExamPage?.id}
              getOmrConfig={getOmrConfig}
              onOmrSave={upsertOmrConfig}
              onOmrDelete={deleteOmrConfig}
            />
          </div>
          {/* 合計点フッター（固定表示） */}
          <div className="bg-muted/30 flex shrink-0 items-center justify-end border-t px-6 py-2">
            <span className="text-sm font-medium">
              合計配点：
              <span className="text-lg font-bold">
                {cropRegions
                  .filter((region) => region.type === "QUESTION_ANSWER")
                  .reduce((sum, region) => sum + (region.points ?? 0), 0)}
              </span>
              点
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
