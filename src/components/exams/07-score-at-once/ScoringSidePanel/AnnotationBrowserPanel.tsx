"use client"

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
import type { AnnotationWithContext } from "@/types/drawingAnnotation.types"

import type { CropRegionWithExamPage } from "../types"
import type {
  AddToTargetsParams,
  AddToTargetsResult,
  AnnotationDisplayItem,
  AnnotationFilters,
} from "./hooks/useAnnotationBrowser"

interface AnnotationBrowserPanelProps {
  examId: string
  currentUserId?: string
  currentCropRegionId?: string
  currentStudentId?: string
  cropRegions: CropRegionWithExamPage[]
  gradingMode: "grid" | "individual"
  // ブラウザーhookから
  displayItems: AnnotationDisplayItem[]
  filters: AnnotationFilters
  isLoading: boolean
  onFiltersChange: (partial: Partial<AnnotationFilters>) => void
  onLoadAnnotations: (examId: string) => Promise<void>
  onToggleFavorite: (id: string, currentFavorite: boolean) => Promise<void>
  onAddToTargets: (params: AddToTargetsParams) => Promise<AddToTargetsResult>
  // QuestionScore確保用
  questionScores: Array<{
    id: string
    studentId: string
    cropRegionId: string
  }>
  selectedScoringDataIds: string[]
  allScoringData: Array<{ id: string; studentId: string }>
  onQuestionScoreCreated?: () => void
  /** ブラウザの+ボタンでアノテーション追加後のコールバック（キャンバスリロード用） */
  onAnnotationAddedFromBrowser?: () => void
  /** アノテーションの生徒・設問に移動 */
  onNavigateTo?: (studentId: string, cropRegionId: string) => void
  /** グループ内全アノテーション参照用 */
  allAnnotations?: AnnotationWithContext[]
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
  if (annotation.questionScore?.student) {
    const student = annotation.questionScore.student
    parts.push(`${student.lastName}${student.firstName}`)
  }
  return parts.join(" / ") || "—"
}

export function AnnotationBrowserPanel({
  examId,
  currentUserId,
  currentCropRegionId,
  currentStudentId,
  cropRegions,
  gradingMode,
  displayItems,
  filters,
  isLoading,
  onFiltersChange,
  onLoadAnnotations,
  onToggleFavorite,
  onAddToTargets,
  questionScores,
  selectedScoringDataIds,
  allScoringData,
  onQuestionScoreCreated,
  onAnnotationAddedFromBrowser,
  onNavigateTo,
  allAnnotations = [],
}: AnnotationBrowserPanelProps) {
  // 初回ロード
  useEffect(() => {
    onLoadAnnotations(examId)
  }, [examId, onLoadAnnotations])

  // ユニークな生徒リスト
  const uniqueStudents = useMemo(() => {
    const studentMap = new Map<
      string,
      { id: string; studentNumber: string; name: string }
    >()
    for (const item of displayItems) {
      const student = item.representative.questionScore?.student
      if (student && !studentMap.has(student.id)) {
        studentMap.set(student.id, {
          id: student.id,
          studentNumber: student.studentNumber,
          name: `${student.lastName}${student.firstName}`,
        })
      }
    }
    return Array.from(studentMap.values()).sort((studentA, studentB) =>
      studentA.studentNumber.localeCompare(studentB.studentNumber, "ja", {
        numeric: true,
      })
    )
  }, [displayItems])

  // QuestionScoreを確保または取得する
  const ensureQuestionScore = useCallback(
    async (studentId: string, cropRegionId: string): Promise<string | null> => {
      // 既存のQuestionScoreを探す
      const existing = questionScores.find(
        (questionScore) =>
          questionScore.studentId === studentId &&
          questionScore.cropRegionId === cropRegionId
      )
      if (existing) return existing.id

      // なければ作成
      if (!currentUserId) return null
      try {
        const result = await window.electronAPI.createQuestionScore({
          cropRegionId,
          studentId,
          userId: currentUserId,
          status: "unscored",
        })
        if (result?.success && result.score?.id) {
          onQuestionScoreCreated?.()
          return result.score.id
        }
      } catch (error) {
        console.error("QuestionScore作成エラー:", error)
      }
      return null
    },
    [questionScores, currentUserId, onQuestionScoreCreated]
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
          if (!currentStudentId || !currentCropRegionId) return
          const qsId = await ensureQuestionScore(
            currentStudentId,
            currentCropRegionId
          )
          if (!qsId) return

          result = await onAddToTargets({
            sourceAnnotation: source,
            targetQuestionScoreIds: [qsId],
            targetCropRegionId: currentCropRegionId,
            sourceCropRegionId,
            userId: currentUserId,
          })
        } else {
          // 一覧モード: 選択中の全生徒に追加
          if (selectedScoringDataIds.length === 0 || !currentCropRegionId)
            return

          // selectedScoringDataIdsからstudentIdをマッピング
          const targetStudentIds = selectedScoringDataIds
            .map((scoringDataId) => {
              const scoringData = allScoringData.find(
                (candidate) => candidate.id === scoringDataId
              )
              return scoringData?.studentId
            })
            .filter((id): id is string => !!id)

          // 各生徒のQuestionScoreを確保
          const targetQsIds: string[] = []
          for (const studentId of targetStudentIds) {
            const qsId = await ensureQuestionScore(
              studentId,
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
            userId: currentUserId,
          })
        }

        // 結果に応じたフィードバック
        if (result && result.created === 0 && result.skipped > 0) {
          toast.info("既に追加済みのアノテーションです")
          return
        }

        // 追加後にアノテーション一覧を再ロード
        await onLoadAnnotations(examId)
        // キャンバスプレビューにも即時反映
        onAnnotationAddedFromBrowser?.()
      } finally {
        isAddingRef.current = false
      }
    },
    [
      currentUserId,
      currentStudentId,
      currentCropRegionId,
      gradingMode,
      selectedScoringDataIds,
      allScoringData,
      ensureQuestionScore,
      onAddToTargets,
      onLoadAnnotations,
      examId,
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
            value={filters.studentId ?? "all"}
            onValueChange={(v) =>
              onFiltersChange({ studentId: v === "all" ? null : v })
            }
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="生徒" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全生徒</SelectItem>
              {uniqueStudents.map((student) => (
                <SelectItem key={student.id} value={student.id}>
                  {student.studentNumber} {student.name}
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
                  item.representative.questionScore?.studentId &&
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
                              item.representative.questionScore!.studentId!,
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
                              !!annotation?.questionScore?.studentId &&
                              !!annotation?.questionScore?.cropRegionId
                          )
                          .map((annotation) => {
                            const student = annotation.questionScore!.student
                            const label = student
                              ? `${student.studentNumber} ${student.lastName}${student.firstName}`
                              : annotation.questionScore!.studentId!.slice(0, 8)
                            const question =
                              annotation.questionScore!.cropRegion?.label ?? ""
                            return (
                              <ContextMenuItem
                                key={annotation.id}
                                onClick={() =>
                                  onNavigateTo(
                                    annotation.questionScore!.studentId!,
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
                          item.representative.questionScore!.studentId!,
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
