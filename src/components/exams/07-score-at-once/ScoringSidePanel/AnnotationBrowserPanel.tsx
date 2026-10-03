"use client"

import { useCallback, useEffect, useMemo, useRef } from "react"
import { toast } from "sonner"

import { studentOption } from "@/lib/searchKeywords"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"
import type {
  AnnotationTarget,
  AnnotationWithContext,
} from "@/types/drawingAnnotation.types"

import { AnnotationBrowserFilters } from "./AnnotationBrowserFilters"
import { AnnotationBrowserItem } from "./AnnotationBrowserItem"
import type {
  AddToTargetsResult,
  AnnotationDisplayItem,
} from "./hooks/useAnnotationBrowser"
import { useAnnotationBrowser } from "./hooks/useAnnotationBrowser"

interface AnnotationBrowserPanelProps {
  examId: string
  currentUserId: string
  currentCropRegionId?: string
  currentExamStudentId?: string
  cropRegions: QuestionAnswerRegionRow[]
  gradingMode: "grid" | "individual"
  /** キャンバス側で手書きが変わったことの合図（増えたら取り直す） */
  annotationRefreshKey?: number
  selectedScoringDataIds: string[]
  allScoringData: Array<{ id: string; examStudentId: string }>
  /** ブラウザの+ボタンでアノテーション追加後のコールバック（キャンバスリロード用） */
  onAnnotationAddedFromBrowser?: () => void
  /** アノテーションの生徒・設問に移動 */
  onNavigateTo?: (examStudentId: string, cropRegionId: string) => void
}

export function AnnotationBrowserPanel({
  examId,
  currentUserId,
  currentCropRegionId,
  currentExamStudentId,
  cropRegions,
  gradingMode,
  annotationRefreshKey,
  selectedScoringDataIds,
  allScoringData,
  onAnnotationAddedFromBrowser,
  onNavigateTo,
}: AnnotationBrowserPanelProps) {
  const {
    allAnnotations,
    displayItems,
    isLoading,
    filters,
    setFilters: onFiltersChange,
    reload,
    toggleFavorite: onToggleFavorite,
    addToTargets: onAddToTargets,
  } = useAnnotationBrowser(examId)

  // キャンバスで手書きが変わったら取り直す。合図が来たときだけ
  const prevRefreshKeyRef = useRef(annotationRefreshKey)
  useEffect(() => {
    if (
      annotationRefreshKey !== undefined &&
      prevRefreshKeyRef.current !== undefined &&
      annotationRefreshKey !== prevRefreshKeyRef.current
    ) {
      void reload()
    }
    prevRefreshKeyRef.current = annotationRefreshKey
  }, [annotationRefreshKey, reload])

  // 絞り込み候補の受験者一覧。フィルタは questionScore.examStudentId と突き合わせるので、
  // 実体（examStudent）をそのまま持ち、氏名は表示時に student から導出する
  // （ここで Student.id へ畳むと、同じ string 型ゆえフィルタが永久に一致しなくなる）。
  const uniqueExamStudents = useMemo(() => {
    const examStudentMap = new Map<
      string,
      NonNullable<
        NonNullable<AnnotationWithContext["questionScore"]>["examStudent"]
      >
    >()
    for (const item of displayItems) {
      const examStudent = item.representative.questionScore?.examStudent
      if (examStudent && !examStudentMap.has(examStudent.id)) {
        examStudentMap.set(examStudent.id, examStudent)
      }
    }
    return Array.from(examStudentMap.values()).sort(
      (examStudentA, examStudentB) =>
        examStudentA.student.studentNumber.localeCompare(
          examStudentB.student.studentNumber,
          "ja",
          { numeric: true }
        )
    )
  }, [displayItems])

  const examStudentFilterOptions = useMemo(
    () => [
      { value: "all", label: "全生徒" },
      ...uniqueExamStudents.map((examStudent) =>
        studentOption(examStudent.id, examStudent.student)
      ),
    ],
    [uniqueExamStudents]
  )

  // 連打防止用フラグ
  const isAddingRef = useRef(false)

  // 「追加」ボタンハンドラ
  const handleAdd = useCallback(
    async (item: AnnotationDisplayItem) => {
      if (isAddingRef.current) return
      isAddingRef.current = true

      try {
        const source = item.representative
        const sourceCropRegionId = source.questionScore?.cropRegionId ?? ""

        let result: AddToTargetsResult | undefined

        if (gradingMode === "individual") {
          // 個別モード: 現在の生徒+設問に追加
          if (!currentExamStudentId || !currentCropRegionId) return

          result = await onAddToTargets({
            sourceAnnotation: source,
            targets: [
              {
                examStudentId: currentExamStudentId,
                cropRegionId: currentCropRegionId,
                userId: currentUserId,
              },
            ],
            targetCropRegionId: currentCropRegionId,
            sourceCropRegionId,
          })
        } else {
          // 一覧モード: 選択中の全生徒に追加
          if (selectedScoringDataIds.length === 0 || !currentCropRegionId)
            return

          // 行き先は「答案＋設問＋採点者」。採点行は無ければ保存のときに main が用意する
          const targets: AnnotationTarget[] = selectedScoringDataIds
            .map((scoringDataId) => {
              const scoringData = allScoringData.find(
                (candidate) => candidate.id === scoringDataId
              )
              return scoringData?.examStudentId
            })
            .filter((examStudentId) => examStudentId !== undefined)
            .map((examStudentId) => ({
              examStudentId,
              cropRegionId: currentCropRegionId,
              userId: currentUserId,
            }))

          if (targets.length === 0) return

          result = await onAddToTargets({
            sourceAnnotation: source,
            targets,
            targetCropRegionId: currentCropRegionId,
            sourceCropRegionId,
          })
        }

        // 結果に応じたフィードバック
        if (result && result.created === 0 && result.skipped > 0) {
          toast.info("既に追加済みのアノテーションです")
          return
        }

        // 一覧の取り直しは書き込み側が済ませている。キャンバスへは合図だけ送る
        onAnnotationAddedFromBrowser?.()
      } finally {
        isAddingRef.current = false
      }
    },
    [
      currentUserId,
      currentExamStudentId,
      currentCropRegionId,
      gradingMode,
      selectedScoringDataIds,
      allScoringData,
      onAddToTargets,
      onAnnotationAddedFromBrowser,
    ]
  )

  return (
    <div className="flex h-full flex-col">
      <AnnotationBrowserFilters
        filters={filters}
        onFiltersChange={onFiltersChange}
        cropRegions={cropRegions}
        examStudentFilterOptions={examStudentFilterOptions}
      />

      {/* リスト */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center p-8 text-sm text-gray-400">
            読み込み中...
          </div>
        ) : displayItems.length === 0 ? (
          <div className="flex items-center justify-center p-8 text-sm text-gray-400">
            アノテーションがありません
          </div>
        ) : (
          <div className="divide-y">
            {displayItems.map((item) => (
              <AnnotationBrowserItem
                key={item.representative.id}
                item={item}
                allAnnotations={allAnnotations}
                onToggleFavorite={onToggleFavorite}
                onNavigateTo={onNavigateTo}
                onAdd={handleAdd}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
