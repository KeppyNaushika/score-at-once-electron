"use client"

import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query"
import Image from "next/image"
import { useParams, useRouter } from "next/navigation"
import { useCallback, useMemo, useState } from "react"

import RegionDetailsTable from "@/components/exams/03-region-info/components/RegionDetailsTable"
import { useOmrConfig } from "@/components/exams/03-region-info/hooks/useOmrConfig"
import { usePageHelp } from "@/components/help/usePageHelp"
import PageHeader from "@/components/layout/PageHeader"
import { Button } from "@/components/ui/button"
import type { CropRegionWithSubtotals } from "@/electron-src/lib/prisma/cropRegion"
import type { ExamPageWithContent } from "@/electron-src/lib/prisma/examPage"
import { queryKeys } from "@/lib/queryKeys"

/** 未取得のときに毎回新しい値を作らないための空値 */
const EMPTY_EXAM_PAGES: ExamPageWithContent[] = []
const EMPTY_IMAGE_URLS: Record<string, string> = {}
const EMPTY_CROP_REGIONS: CropRegionWithSubtotals[] = []

/** この画面が1回の取得で揃える形 */
interface RegionInfoData {
  currentUser: Awaited<
    ReturnType<typeof window.electronAPI.getCurrentUser>
  >
  examPages: ExamPageWithContent[]
  backgroundImageUrls: Record<string, string>
  cropRegions: CropRegionWithSubtotals[]
}

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
  /** 表示中のページ。未選択なら取得結果の先頭を出す */
  const [selectedExamPageId, setSelectedExamPageId] = useState<string | null>(
    null
  )
  const queryClient = useQueryClient()

  // OMR設定管理
  const { getOmrConfig, upsertOmrConfig, deleteOmrConfig } = useOmrConfig(
    examId ?? ""
  )

  // ページ・背景画像・採点領域・操作者は必ず揃って初めて編集できるので、
  // 1つの取得にまとめる（片方だけ古い状態で描かない）
  const queryKey = useMemo(
    () => queryKeys.exam.cropRegions(examId ?? ""),
    [examId]
  )
  const { data, isPending: isLoading } = useQuery<RegionInfoData>({
    queryKey,
    queryFn: examId
      ? async () => {
          const [currentUser, exam, cropRegions] = await Promise.all([
            window.electronAPI.getCurrentUser(),
            // 試験が存在しなければ null（不存在を検知する）
            window.electronAPI.getExamWithPages(examId),
            window.electronAPI.getCropRegionsByExamId(examId),
          ])
          if (!exam) throw new Error("試験が見つかりません。")

          const examPages = [...exam.examPages].sort(
            (pageA, pageB) => pageA.pageNumber - pageB.pageNumber
          )
          const backgroundImageUrls = Object.fromEntries(
            await Promise.all(
              examPages
                .filter((page) => page.imagePath)
                .map(
                  async (page) =>
                    [
                      page.id,
                      await window.electronAPI.resolveFileProtocolPath(
                        page.imagePath!
                      ),
                    ] as const
                )
            )
          )
          return { currentUser, examPages, backgroundImageUrls, cropRegions }
        }
      : skipToken,
  })
  const currentUser = data?.currentUser ?? null
  const examPages = data?.examPages ?? EMPTY_EXAM_PAGES
  const backgroundImageUrls = data?.backgroundImageUrls ?? EMPTY_IMAGE_URLS
  const cropRegions = data?.cropRegions ?? EMPTY_CROP_REGIONS

  /** 編集中の採点領域でキャッシュを差し替える（自動保存の往復を待たせない） */
  const setCropRegions = useCallback(
    (regions: CropRegionWithSubtotals[]) => {
      queryClient.setQueryData<RegionInfoData>(queryKey, (previous) =>
        previous ? { ...previous, cropRegions: regions } : previous
      )
    },
    [queryClient, queryKey]
  )

  // 表示中のページ。未選択なら先頭を出す（取得結果から導くので state を持たない）
  const selectedExamPage =
    examPages.find((page) => page.id === selectedExamPageId) ??
    examPages[0] ??
    null

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
    [examId, currentUser, setCropRegions]
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
    [saveTimeoutId, autoSaveRegions, cropRegions, setCropRegions]
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
                      <div className="text-xs text-muted-foreground">
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
                            setSelectedExamPageId(page.id)
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
                        <div className="text-sm text-muted-foreground">
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
          <div className="flex justify-between border-t p-2 text-xs text-muted-foreground">
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
              <p className="text-sm text-muted-foreground">
                全ページ {cropRegions.length}個の領域を統一順序で表示
                {selectedExamPage && (
                  <span className="ml-2 text-blue-600">
                    ※ ページ {selectedExamPage.pageNumber} を選択中
                  </span>
                )}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
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
          <div className="flex shrink-0 items-center justify-end border-t bg-muted/30 px-6 py-2">
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
