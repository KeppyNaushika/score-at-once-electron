"use client"

import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query"
import Image from "next/image"
import { useParams } from "next/navigation"
import { useMemo, useState } from "react"

import RegionDetailsTable from "@/components/exams/03-region-info/components/RegionDetailsTable"
import { useOmrConfig } from "@/components/exams/03-region-info/hooks/useOmrConfig"
import { Button } from "@/components/ui/button"
import type { ExamPageWithContent } from "@/electron-src/lib/prisma/examPage"
import { type CropRegionRow, cropRegionsQuery } from "@/queries/cropRegion"
import { examPagesQuery } from "@/queries/exam"
import { scopeKeys } from "@/queries/keys"
import { fileProtocolPathQuery } from "@/queries/misc"

/** 未取得のときに毎回新しい値を作らないための空値 */
const EMPTY_EXAM_PAGES: ExamPageWithContent[] = []
const EMPTY_CROP_REGIONS: CropRegionRow[] = []

export default function RegionInfoPage() {
  const params = useParams()
  const examId = typeof params.examId === "string" ? params.examId : ""

  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null)
  /** 表示中のページ。未選択なら取得結果の先頭を出す */
  const [selectedExamPageId, setSelectedExamPageId] = useState<string | null>(
    null
  )
  const queryClient = useQueryClient()

  // OMR設定管理
  const { getOmrConfig, upsertOmrConfig, deleteOmrConfig } =
    useOmrConfig(examId)

  const {
    data: fetchedExamPages = EMPTY_EXAM_PAGES,
    isPending: examPagesPending,
    error: examPagesError,
  } = useQuery(examPagesQuery(examId))
  const {
    data: cropRegions = EMPTY_CROP_REGIONS,
    isPending: cropRegionsPending,
    error: cropRegionsError,
  } = useQuery(cropRegionsQuery(examId))

  const isLoading = examPagesPending || cropRegionsPending
  const error = examPagesError ?? cropRegionsError

  // 一覧はページ番号順に出す（並べ替えは表示のたびに行う）
  const examPages = useMemo(
    () =>
      [...fetchedExamPages].sort(
        (pageA, pageB) => pageA.pageNumber - pageB.pageNumber
      ),
    [fetchedExamPages]
  )

  // 背景画像はページごとに引く。画像を持たないページは引かない
  const backgroundImageUrls = useQueries({
    queries: examPages.map((examPage) => ({
      ...fileProtocolPathQuery(examPage.imagePath ?? ""),
      enabled: Boolean(examPage.imagePath),
    })),
    combine: (results: { data?: string }[]) =>
      Object.fromEntries(
        examPages.map((examPage, index) => [
          examPage.id,
          examPage.imagePath ? (results[index]?.data ?? "") : "",
        ])
      ),
  })

  // 表示中のページ。未選択なら先頭を出す（取得結果から導くので state を持たない）
  const selectedExamPage =
    examPages.find((examPage) => examPage.id === selectedExamPageId) ??
    examPages[0] ??
    null

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p>領域情報を読み込み中...</p>
      </div>
    )
  }
  // 取得に失敗したまま編集画面を出すと、保存が黙って何もしない（操作者が居ない）
  if (error) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <h2 className="text-lg font-semibold text-red-600">
              エラーが発生しました
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {error.message}
            </p>
            <Button
              onClick={() =>
                // 失敗しうるのは採点領域だけではない。エラー画面はページの取得の
                // 失敗でも出るので、この画面が読んでいるもの全部を取り直す
                // （retry: false なので、取り直さない方が残ると二度と戻れない）
                queryClient.invalidateQueries({
                  queryKey: scopeKeys.exam(examId),
                })
              }
              className="mt-4"
              variant="outline"
            >
              再読み込み
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
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
              examId={examId}
              regions={cropRegions}
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
