"use client"

import { useMutation } from "@tanstack/react-query"
import {
  Circle,
  Eye,
  Minus,
  Plus,
  RectangleHorizontal,
  Star,
  Type,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useRef } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { createQuestionScoreMutation } from "@/queries/scoring"
import type { AnnotationWithContext } from "@/types/drawingAnnotation.types"

import type { CropRegionWithExamPage } from "../types"
import type {
  AddToTargetsResult,
  AnnotationDisplayItem,
} from "./hooks/useAnnotationBrowser"
import { useAnnotationBrowser } from "./hooks/useAnnotationBrowser"

interface AnnotationBrowserPanelProps {
  examId: string
  currentUserId?: string
  currentCropRegionId?: string
  currentExamStudentId?: string
  cropRegions: CropRegionWithExamPage[]
  gradingMode: "grid" | "individual"
  /** キャンバス側で手書きが変わったことの合図（増えたら取り直す） */
  annotationRefreshKey?: number
  // QuestionScore確保用
  questionScores: Array<{
    id: string
    examStudentId: string
    cropRegionId: string
  }>
  selectedScoringDataIds: string[]
  allScoringData: Array<{ id: string; examStudentId: string }>
  onQuestionScoreCreated?: () => void
  /** ブラウザの+ボタンでアノテーション追加後のコールバック（キャンバスリロード用） */
  onAnnotationAddedFromBrowser?: () => void
  /** アノテーションの生徒・設問に移動 */
  onNavigateTo?: (examStudentId: string, cropRegionId: string) => void
}

// アノテーションタイプのアイコン
function TypeIcon({ type }: { type: string }) {
  switch (type) {
    case "text":
      return <Type className="h-3.5 w-3.5" />
    case "line":
      return <Minus className="h-3.5 w-3.5" />
    case "rectangle":
      return <RectangleHorizontal className="h-3.5 w-3.5" />
    case "ellipse":
      return <Circle className="h-3.5 w-3.5" />
    default:
      return null
  }
}

// アノテーションの説明テキスト
function getDescription(annotation: AnnotationWithContext): string {
  if (annotation.type === "text") {
    const text = annotation.text || ""
    return text.length > 20 ? text.substring(0, 20) + "…" : text || "(空)"
  }
  const typeNames: Record<string, string> = {
    line: "直線",
    rectangle: "長方形",
    ellipse: "楕円",
  }
  return typeNames[annotation.type] || annotation.type
}

// ソース情報（設問 + 生徒）
function getSourceInfo(annotation: AnnotationWithContext): string {
  const parts: string[] = []
  if (annotation.questionScore?.cropRegion?.label) {
    parts.push(annotation.questionScore.cropRegion.label)
  }
  if (annotation.questionScore?.examStudent?.student) {
    const { student } = annotation.questionScore.examStudent
    parts.push(`${student.lastName}${student.firstName}`)
  }
  return parts.join(" / ") || "—"
}

export function AnnotationBrowserPanel({
  examId,
  currentUserId,
  currentCropRegionId,
  currentExamStudentId,
  cropRegions,
  gradingMode,
  annotationRefreshKey,
  questionScores,
  selectedScoringDataIds,
  allScoringData,
  onQuestionScoreCreated,
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
  const { mutateAsync: createQuestionScore } = useMutation(
    createQuestionScoreMutation(examId)
  )

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

  // QuestionScoreを確保または取得する
  const ensureQuestionScore = useCallback(
    async (
      examStudentId: string,
      cropRegionId: string
    ): Promise<string | null> => {
      // 既存のQuestionScoreを探す
      const existing = questionScores.find(
        (questionScore) =>
          questionScore.examStudentId === examStudentId &&
          questionScore.cropRegionId === cropRegionId
      )
      if (existing) return existing.id

      // なければ作成
      if (!currentUserId) return null
      try {
        const created = await createQuestionScore({
          cropRegionId,
          examStudentId,
          userId: currentUserId,
          status: "unscored",
        })
        onQuestionScoreCreated?.()
        return created.id
      } catch {
        // 失敗の通知は MutationCache の後始末が出す
      }
      return null
    },
    [questionScores, currentUserId, createQuestionScore, onQuestionScoreCreated]
  )

  // 連打防止用フラグ
  const isAddingRef = useRef(false)

  // 「追加」ボタンハンドラ
  const handleAdd = useCallback(
    async (item: AnnotationDisplayItem) => {
      if (!currentUserId) return
      if (isAddingRef.current) return
      isAddingRef.current = true

      try {
        const source = item.representative
        const sourceCropRegionId = source.questionScore?.cropRegionId ?? ""

        let result: AddToTargetsResult | undefined

        if (gradingMode === "individual") {
          // 個別モード: 現在の生徒+設問に追加
          if (!currentExamStudentId || !currentCropRegionId) return
          const qsId = await ensureQuestionScore(
            currentExamStudentId,
            currentCropRegionId
          )
          if (!qsId) return

          result = await onAddToTargets({
            sourceAnnotation: source,
            targetQuestionScoreIds: [qsId],
            targetCropRegionId: currentCropRegionId,
            sourceCropRegionId,
          })
        } else {
          // 一覧モード: 選択中の全生徒に追加
          if (selectedScoringDataIds.length === 0 || !currentCropRegionId)
            return

          // selectedScoringDataIdsからexamStudentIdをマッピング
          const targetStudentIds = selectedScoringDataIds
            .map((scoringDataId) => {
              const scoringData = allScoringData.find(
                (candidate) => candidate.id === scoringDataId
              )
              return scoringData?.examStudentId
            })
            .filter((id): id is string => !!id)

          // 各生徒のQuestionScoreを確保
          const targetQsIds: string[] = []
          for (const examStudentId of targetStudentIds) {
            const qsId = await ensureQuestionScore(
              examStudentId,
              currentCropRegionId
            )
            if (qsId) targetQsIds.push(qsId)
          }

          if (targetQsIds.length === 0) return

          result = await onAddToTargets({
            sourceAnnotation: source,
            targetQuestionScoreIds: targetQsIds,
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
      ensureQuestionScore,
      onAddToTargets,
      onAnnotationAddedFromBrowser,
    ]
  )

  return (
    <div className="flex h-full flex-col">
      {/* フィルタバー */}
      <div className="space-y-2 border-b p-3">
        <div className="grid grid-cols-2 gap-2">
          {/* 設問フィルタ */}
          <Select
            value={filters.cropRegionId ?? "all"}
            onValueChange={(v) =>
              onFiltersChange({ cropRegionId: v === "all" ? null : v })
            }
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="設問" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全設問</SelectItem>
              {cropRegions.map((cropRegion) => (
                <SelectItem key={cropRegion.id} value={cropRegion.id}>
                  {cropRegion.label || cropRegion.id.slice(0, 6)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* 生徒フィルタ */}
          <Select
            value={filters.examStudentId ?? "all"}
            onValueChange={(v) =>
              onFiltersChange({ examStudentId: v === "all" ? null : v })
            }
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="生徒" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全生徒</SelectItem>
              {uniqueExamStudents.map((examStudent) => (
                <SelectItem key={examStudent.id} value={examStudent.id}>
                  {examStudent.student.studentNumber}{" "}
                  {examStudent.student.lastName}
                  {examStudent.student.firstName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          {/* 種類フィルタ */}
          <Select
            value={filters.type ?? "all"}
            onValueChange={(v) =>
              onFiltersChange({
                type:
                  v === "all"
                    ? null
                    : (v as "text" | "line" | "rectangle" | "ellipse"),
              })
            }
          >
            <SelectTrigger className="h-8 flex-1 text-xs">
              <SelectValue placeholder="種類" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全種類</SelectItem>
              <SelectItem value="text">テキスト</SelectItem>
              <SelectItem value="line">直線</SelectItem>
              <SelectItem value="rectangle">長方形</SelectItem>
              <SelectItem value="ellipse">楕円</SelectItem>
            </SelectContent>
          </Select>

          {/* お気に入りのみトグル */}
          <Button
            variant={filters.favoritesOnly ? "default" : "outline"}
            size="sm"
            className="h-8 shrink-0 px-2"
            onClick={() =>
              onFiltersChange({ favoritesOnly: !filters.favoritesOnly })
            }
          >
            <Star
              className={cn(
                "h-3.5 w-3.5",
                filters.favoritesOnly && "fill-current"
              )}
            />
          </Button>
        </div>
      </div>

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
              <div
                key={item.representative.id}
                className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50"
              >
                {/* タイプアイコン */}
                <div className="shrink-0 text-gray-500">
                  <TypeIcon type={item.representative.type} />
                </div>

                {/* 説明 + ソース */}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium">
                    {getDescription(item.representative)}
                  </div>
                  <div className="truncate text-xs text-gray-400">
                    {getSourceInfo(item.representative)}
                  </div>
                </div>

                {/* 色ドット */}
                <div
                  className="h-3 w-3 shrink-0 rounded-full border border-gray-200"
                  style={{ backgroundColor: item.representative.color }}
                />

                {/* 件数バッジ */}
                {item.count > 1 && (
                  <span className="shrink-0 rounded-full bg-gray-200 px-1.5 py-0.5 text-xs text-gray-600">
                    ×{item.count}
                  </span>
                )}

                {/* 星アイコン */}
                <button
                  className="shrink-0 text-gray-400 hover:text-yellow-500"
                  onClick={() =>
                    onToggleFavorite(item.representative.id, item.isFavorite)
                  }
                >
                  <Star
                    className={cn(
                      "h-3.5 w-3.5",
                      item.isFavorite && "fill-yellow-400 text-yellow-400"
                    )}
                  />
                </button>

                {/* 移動ボタン（左クリック: 代表に移動, 右クリック: 生徒選択メニュー） */}
                {onNavigateTo &&
                  item.representative.questionScore?.examStudentId &&
                  item.representative.questionScore?.cropRegionId &&
                  (item.count > 1 ? (
                    <ContextMenu>
                      <ContextMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 shrink-0 px-1.5 text-gray-400 hover:text-blue-500"
                          title="クリック: 移動 / 右クリック: 生徒選択"
                          onClick={() =>
                            onNavigateTo(
                              item.representative.questionScore!.examStudentId!,
                              item.representative.questionScore!.cropRegionId!
                            )
                          }
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </ContextMenuTrigger>
                      <ContextMenuContent>
                        {item.allIds
                          .map((id) =>
                            allAnnotations.find(
                              (annotation) => annotation.id === id
                            )
                          )
                          .filter(
                            (annotation): annotation is AnnotationWithContext =>
                              !!annotation?.questionScore?.examStudentId &&
                              !!annotation?.questionScore?.cropRegionId
                          )
                          .map((annotation) => {
                            const student =
                              annotation.questionScore!.examStudent?.student
                            const label = student
                              ? `${student.studentNumber} ${student.lastName}${student.firstName}`
                              : annotation.questionScore!.examStudentId!.slice(
                                  0,
                                  8
                                )
                            const question =
                              annotation.questionScore!.cropRegion?.label ?? ""
                            return (
                              <ContextMenuItem
                                key={annotation.id}
                                onClick={() =>
                                  onNavigateTo(
                                    annotation.questionScore!.examStudentId!,
                                    annotation.questionScore!.cropRegionId!
                                  )
                                }
                              >
                                {label}
                                {question && (
                                  <span className="ml-2 text-xs text-gray-400">
                                    {question}
                                  </span>
                                )}
                              </ContextMenuItem>
                            )
                          })}
                      </ContextMenuContent>
                    </ContextMenu>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 shrink-0 px-1.5 text-gray-400 hover:text-blue-500"
                      title="この生徒・設問に移動"
                      onClick={() =>
                        onNavigateTo(
                          item.representative.questionScore!.examStudentId!,
                          item.representative.questionScore!.cropRegionId!
                        )
                      }
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                  ))}

                {/* 追加ボタン */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 shrink-0 px-1.5"
                  onClick={() => handleAdd(item)}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
