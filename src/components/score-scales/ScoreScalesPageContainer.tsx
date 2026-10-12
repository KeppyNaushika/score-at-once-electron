"use client"

import { useMutation, useQuery } from "@tanstack/react-query"
import { Layers, Plus } from "lucide-react"
import { useState } from "react"

import {
  type ToolbarAction,
  toolbarButtonAction,
} from "@/components/common/OverflowToolbar"
import PageHeader from "@/components/layout/PageHeader"
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import {
  allScoreScalesQuery,
  createScoreScaleMutation,
  type ScoreScaleRow,
} from "@/queries/scoreScale"

import { ScoreScaleEditor } from "./ScoreScaleEditor"
import { ScoreScaleListItem } from "./ScoreScaleListItem"
import { defaultScaleLevels } from "./utils/scoreScaleUsage"

/** 一覧の絞り込み（使える範囲）。既定は共通 */
const SCOPE_FILTERS = ["global", "exam", "all"] as const
type ScopeFilter = (typeof SCOPE_FILTERS)[number]

const SCOPE_FILTER_LABELS: Record<ScopeFilter, string> = {
  global: "共通",
  exam: "試験のもの",
  all: "すべて",
}

const matchesScopeFilter = (
  scoreScale: ScoreScaleRow,
  scopeFilter: ScopeFilter
): boolean => {
  if (scopeFilter === "all") return true
  return (scoreScale.examId === null) === (scopeFilter === "global")
}

/** 管理の画面で新しく作る共通の類型評価の名前（あとから直せる） */
const NEW_SCORE_SCALE_NAME = "類型評価"

/** 未取得のときに毎回新しい配列を作らないための空値 */
const EMPTY_SCORE_SCALES: ScoreScaleRow[] = []

/**
 * 類型評価管理（docs/vlm-grading-design.md §4-8-3a）。
 *
 * 共通の類型評価の一覧と編集。どの試験のどの設問が使っているかを示す。
 * 試験の類型評価も絞り込みで出し、共通にできる。作る・直す・消すは 03 の領域情報からもできる
 */
export function ScoreScalesPageContainer() {
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>("global")
  const [selectedScoreScaleId, setSelectedScoreScaleId] = useState<
    string | null
  >(null)
  const {
    data: scoreScales = EMPTY_SCORE_SCALES,
    isPending,
    error,
  } = useQuery(allScoreScalesQuery())
  const { mutateAsync: createScoreScale, isPending: creating } = useMutation(
    createScoreScaleMutation()
  )

  const filteredScoreScales = scoreScales.filter((scoreScale) =>
    matchesScopeFilter(scoreScale, scopeFilter)
  )
  // 選択は id で持つ。消えた（同期で消された）組を指していれば、どれも開かない
  const selectedScoreScale =
    scoreScales.find((scoreScale) => scoreScale.id === selectedScoreScaleId) ??
    null

  const handleCreate = async () => {
    try {
      const created = await createScoreScale({
        examId: null,
        name: NEW_SCORE_SCALE_NAME,
        levels: defaultScaleLevels(null),
      })
      // 作ったものが一覧に見えるよう、試験のものだけを出していれば共通へ切り替える
      if (scopeFilter === "exam") setScopeFilter("global")
      setSelectedScoreScaleId(created.id)
    } catch {
      // 失敗の通知は MutationCache の後始末が担う
    }
  }

  const changeScopeFilter = (value: string) => {
    const nextFilter = SCOPE_FILTERS.find((filter) => filter === value)
    if (nextFilter) setScopeFilter(nextFilter)
  }

  const scopeFilterSelect = (className: string) => (
    <Select value={scopeFilter} onValueChange={changeScopeFilter}>
      <SelectTrigger className={className} aria-label="使える範囲で絞り込む">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SCOPE_FILTERS.map((filter) => (
          <SelectItem key={filter} value={filter}>
            {SCOPE_FILTER_LABELS[filter]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )

  const toolbarActions: ToolbarAction[] = [
    {
      id: "scope-filter",
      priority: 90,
      node: scopeFilterSelect("h-8 w-36"),
      collapsedNode: scopeFilterSelect("h-8 w-full"),
    },
    toolbarButtonAction({
      id: "create",
      priority: 80,
      icon: Plus,
      label: "共通の類型評価を作成",
      onClick: () => void handleCreate(),
      disabled: creating,
    }),
  ]

  return (
    <div className="flex h-full min-w-full flex-col">
      <PageHeader
        title="類型評価管理"
        subtitle={isPending ? undefined : `${filteredScoreScales.length}件`}
        actions={toolbarActions}
      />

      {error && (
        <div className="mx-4 mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error.message}
        </div>
      )}

      <div className="flex min-h-0 flex-1 gap-4 p-4">
        <div className="w-80 shrink-0 space-y-2 overflow-auto">
          {isPending ? (
            <div className="flex h-full items-center justify-center">
              <Spinner className="size-6" />
            </div>
          ) : filteredScoreScales.length === 0 ? (
            <Empty className="h-full rounded-lg border border-dashed">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Layers />
                </EmptyMedia>
                <EmptyTitle>類型評価がありません</EmptyTitle>
              </EmptyHeader>
            </Empty>
          ) : (
            filteredScoreScales.map((scoreScale) => (
              <ScoreScaleListItem
                key={scoreScale.id}
                scoreScale={scoreScale}
                isSelected={scoreScale.id === selectedScoreScaleId}
                onSelect={() => setSelectedScoreScaleId(scoreScale.id)}
              />
            ))
          )}
        </div>
        <div className="min-w-0 flex-1 overflow-auto">
          {selectedScoreScale ? (
            <ScoreScaleEditor
              key={selectedScoreScale.id}
              scoreScale={selectedScoreScale}
              contextExamId={null}
              onDeleted={() => setSelectedScoreScaleId(null)}
            />
          ) : (
            <p className="p-4 text-sm text-muted-foreground">
              一覧から類型評価を選ぶと、類型と説明と点数を直せます。
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
