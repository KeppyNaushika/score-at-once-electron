"use client"

import {
  AlertCircle,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  FileText,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"

import { ShortcutTooltip } from "./ShortcutTooltip"
import { SidePanelSection } from "./SidePanelSection"

/** 設問ごとの採点の進み具合 */
interface QuestionProgressCounts {
  totalAnswers: number
  gradedAnswers: number
  percentage: number
}

/** 設問ボタン右上の印の種類 */
type QuestionBadgeKind = "none" | "inProgress" | "unreflectedAi" | "completed"

/**
 * 設問ボタン右上の印を決める。弱い順に 無印 < 緑の丸（採点中） < オレンジの丸（AI の判定が
 * 未反映） < 緑のチェック（採点済み）で、強いほうを出す。
 *
 * 完了・着手は件数で見る（`percentage` は四捨五入なので、200件中199件で 100% になり、
 * 1件で 0% になる）。
 */
function questionBadgeKindOf(
  progress: QuestionProgressCounts | undefined,
  hasUnreflectedAi: boolean
): QuestionBadgeKind {
  if (
    progress &&
    progress.totalAnswers > 0 &&
    progress.gradedAnswers >= progress.totalAnswers
  ) {
    return "completed"
  }
  if (hasUnreflectedAi) return "unreflectedAi"
  if (progress && progress.gradedAnswers > 0) return "inProgress"
  return "none"
}

interface QuestionNavigatorProps {
  questionRegions: QuestionAnswerRegionRow[]
  currentCropRegion?: QuestionAnswerRegionRow | null
  onCropRegionChange: (cropRegion: QuestionAnswerRegionRow | null) => void
  onPrevQuestion: () => void
  onNextQuestion: () => void
  questionProgress?: {
    [questionId: string]: QuestionProgressCounts
  }
  collapsible?: boolean
  isOpen?: boolean
  onToggle?: () => void
  /** 採点担当により設問が絞られている（見えない設問がある理由を伝える） */
  isFilteredByAssignment?: boolean
  /**
   * AI の判定があるのに自分がまだ採点していない答案のある設問。
   * 右上の丸をオレンジにする（採点済みのチェックが優先）
   */
  unreflectedAiQuestionIds?: ReadonlySet<string>
}

export default function QuestionNavigator({
  questionRegions,
  currentCropRegion,
  onCropRegionChange,
  onPrevQuestion,
  onNextQuestion,
  questionProgress,
  collapsible = false,
  isOpen = true,
  onToggle,
  isFilteredByAssignment = false,
  unreflectedAiQuestionIds,
}: QuestionNavigatorProps) {
  const currentIndex = currentCropRegion
    ? questionRegions.findIndex(
        (question) => question.id === currentCropRegion.id
      )
    : -1

  // 0/0の設問を特定
  const zeroProgressQuestions = Object.entries(questionProgress || {}).filter(
    ([_, progress]) =>
      progress.totalAnswers === 0 && progress.gradedAnswers === 0
  )

  if (zeroProgressQuestions.length > 0) {
    console.warn(
      "🚨 QuestionNavigator: 0/0 progress questions:",
      zeroProgressQuestions.map(([id, progress]) => {
        const region = questionRegions.find(
          (questionRegion) => questionRegion.id === id
        )
        return {
          questionId: id,
          questionLabel: region?.label || "Unknown",
          ...progress,
        }
      })
    )
  }
  return (
    <TooltipProvider delayDuration={300}>
      <SidePanelSection
        icon={FileText}
        title="設問"
        collapsible={collapsible}
        isOpen={isOpen}
        onToggle={onToggle}
      >
        {isFilteredByAssignment && (
          <div className="mb-2 rounded bg-blue-50 px-2 py-1 text-[10px] text-blue-700">
            自分が担当する設問のみ表示しています
          </div>
        )}

        {/* ナビゲーション: [前] [設問プルダウン] [次] */}
        <div className="flex items-center gap-2">
          <ShortcutTooltip description="前の設問に移動" keys={["Shift", "A"]}>
            <Button
              variant="outline"
              size="sm"
              onClick={onPrevQuestion}
              disabled={currentIndex === 0 || currentIndex === -1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </ShortcutTooltip>

          <Select
            value={currentCropRegion?.id || ""}
            onValueChange={(value) => {
              const selectedRegion =
                questionRegions.find((question) => question.id === value) ||
                null
              onCropRegionChange(selectedRegion)
            }}
          >
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="設問を選択" />
            </SelectTrigger>
            <SelectContent>
              {questionRegions.map((question, _index) => {
                const progress = questionProgress?.[question.id]
                return (
                  <SelectItem
                    key={question.id}
                    value={question.id}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <span>{question.label || question.orderIndex || 1}</span>
                      <Badge variant="outline" className="text-xs">
                        {question.points || 0}点
                      </Badge>
                    </div>
                    {progress && (
                      <div className="ml-auto flex items-center gap-1">
                        {progress.percentage === 100 ? (
                          <CheckCircle className="h-3 w-3 text-green-500" />
                        ) : progress.percentage > 0 ? (
                          <AlertCircle className="h-3 w-3 text-yellow-500" />
                        ) : null}
                        <span className="text-xs text-gray-500">
                          {progress.gradedAnswers}/{progress.totalAnswers}
                        </span>
                      </div>
                    )}
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>

          <ShortcutTooltip description="次の設問に移動" keys={["Shift", "D"]}>
            <Button
              variant="outline"
              size="sm"
              onClick={onNextQuestion}
              disabled={
                currentIndex === questionRegions.length - 1 ||
                currentIndex === -1
              }
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </ShortcutTooltip>
        </div>

        {/* 設問一覧（サムネイル表示） */}
        <div className="mt-3 border-t border-gray-100 pt-3">
          <div className="mb-2 text-xs text-gray-500">
            設問一覧（クリックで移動）
          </div>
          <div className="flex flex-wrap gap-2">
            {questionRegions.map((question, _index) => {
              const progress = questionProgress?.[question.id]
              const isActive = question.id === currentCropRegion?.id
              const hasUnreflectedAi =
                unreflectedAiQuestionIds?.has(question.id) ?? false
              const badgeKind = questionBadgeKindOf(progress, hasUnreflectedAi)
              return (
                <Tooltip key={question.id}>
                  <TooltipTrigger asChild>
                    <Button
                      variant={isActive ? "default" : "outline"}
                      size="sm"
                      className={`relative h-8 px-2 ${
                        isActive ? "" : "hover:bg-gray-50"
                      }`}
                      onClick={() => onCropRegionChange(question)}
                    >
                      <span className="text-xs">
                        {question.label || question.orderIndex || 1}
                      </span>
                      {badgeKind === "completed" && (
                        <div
                          className="absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full bg-green-500"
                          aria-label="採点済み"
                        >
                          <CheckCircle className="h-2 w-2 text-white" />
                        </div>
                      )}
                      {badgeKind === "unreflectedAi" && (
                        <div
                          className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-orange-500"
                          aria-label="AI の判定が未反映"
                        />
                      )}
                      {badgeKind === "inProgress" && (
                        <div
                          className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-green-500"
                          aria-label="採点中"
                        />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-center">
                      <div className="font-medium">
                        {question.label || question.orderIndex || 1}
                      </div>
                      <div className="text-xs text-gray-400">
                        {question.label}
                      </div>
                      <div className="text-xs text-gray-400">
                        {question.points || 0}点
                      </div>
                      {progress && (
                        <div className="mt-1 text-xs text-gray-400">
                          進捗: {progress.percentage}%
                        </div>
                      )}
                      {hasUnreflectedAi && (
                        <div className="mt-1 text-xs text-orange-400">
                          AI の判定が未反映の未採点あり
                        </div>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              )
            })}
          </div>
        </div>
      </SidePanelSection>
    </TooltipProvider>
  )
}
