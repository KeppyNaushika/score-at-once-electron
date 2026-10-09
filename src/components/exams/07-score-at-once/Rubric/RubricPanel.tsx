"use client"

import { ListChecks, Plus, Undo2 } from "lucide-react"
import { useMemo, useState } from "react"

import { useChoiceScene } from "@/components/exams/07-score-at-once/hooks/useChoiceScene"
import { Button } from "@/components/ui/button"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"
import type { RubricItemRow } from "@/queries/rubric"
import type { QuestionScoreRow } from "@/queries/scoring"
import { toScoringMethod } from "@/types/rubric.types"

import {
  type SelectedRubricCell,
  useRubricApplying,
} from "./hooks/useRubricApplying"
import { useRubricItemEditing } from "./hooks/useRubricItemEditing"
import { useRubricQuestion } from "./hooks/useRubricQuestion"
import { useRubricRecalculation } from "./hooks/useRubricRecalculation"
import { useScoringKeysPausedWhile } from "./hooks/useScoringKeysPausedWhile"
import { RubricItemEditorDialog } from "./RubricItemEditorDialog"
import { RubricItemEntry } from "./RubricItemEntry"
import { RubricRecalculationDialog } from "./RubricRecalculationDialog"
import { SCORING_METHOD_LABELS } from "./utils/rubricEffectLabel"

interface RubricPanelProps {
  examId: string
  /** 減点・加点方式の設問（直接採点の設問ではこのパネルを出さない） */
  cropRegion: QuestionAnswerRegionRow
  currentUserId: string
  /** その設問の採点行（採点者を問わない） */
  questionScores: readonly QuestionScoreRow[]
  /** 選んでいる答案の受験者（一覧表示では複数、個別表示では表示中の1人） */
  selectedExamStudentIds: readonly string[]
  /** 選択の場面の Enter（確定して次へ）: 次の答案を選ぶ */
  onAdvance: () => void
  /** 点を書いた答案を「いま採点した」にする */
  onScored?: (examStudentIds: string[]) => void
}

/** 編集画面の開き方。null は閉じている */
type EditorTarget =
  | { kind: "create"; appliesAfterCreate: boolean }
  | { kind: "edit"; rubricItem: RubricItemRow }

/**
 * 左のルーブリック項目のパネル（docs/vlm-grading-design.md §4・§11）。
 *
 * 項目を押す（または選択の場面で番号を押す）と、選んだ答案に当てる・外す。
 * 当てた答案の点は項目から計算して書く。採点キーで付けた点は「手での上書き」になり、
 * ここから項目の点へ戻せる
 */
export function RubricPanel({
  examId,
  cropRegion,
  currentUserId,
  questionScores,
  selectedExamStudentIds,
  onAdvance,
  onScored,
}: RubricPanelProps) {
  const scoringMethod = toScoringMethod(cropRegion.scoringMethod)
  const { rubricItems, ownCellOf } = useRubricQuestion({
    examId,
    cropRegionId: cropRegion.id,
    currentUserId,
    questionScores,
  })
  const selectedCells = useMemo<SelectedRubricCell[]>(
    () =>
      selectedExamStudentIds.map((examStudentId) => ({
        examStudentId,
        ...ownCellOf(examStudentId),
      })),
    [selectedExamStudentIds, ownCellOf]
  )
  const overriddenCount = selectedCells.filter(
    (cell) => cell.overridesRubric
  ).length

  const { toggleItem, clearOverrides } = useRubricApplying({
    examId,
    cropRegion,
    selectedCells,
    onScored,
  })
  const { runWithRecalculation, pending, cancel } = useRubricRecalculation({
    examId,
    cropRegionId: cropRegion.id,
    currentUserId,
  })
  const editing = useRubricItemEditing({
    examId,
    cropRegion,
    rubricItems,
    runWithRecalculation,
  })

  const [editorTarget, setEditorTarget] = useState<EditorTarget | null>(null)
  useScoringKeysPausedWhile(editorTarget !== null || pending !== null)

  const choiceScene = useChoiceScene({
    entryCount: rubricItems.length,
    onSelect: (entryIndex) => toggleItem(rubricItems[entryIndex].id),
    onOther: () => {
      choiceScene.close()
      setEditorTarget({ kind: "create", appliesAfterCreate: true })
    },
    onConfirm: onAdvance,
  })

  const handleSubmit = async (
    target: EditorTarget,
    draft: Parameters<typeof editing.create>[0]
  ) => {
    if (target.kind === "edit") {
      return editing.update(target.rubricItem, draft)
    }
    const created = await editing.create(draft)
    if (!created) return false
    if (target.appliesAfterCreate && selectedCells.length > 0) {
      toggleItem(created.id)
    }
    return true
  }

  return (
    <div className="flex h-full w-72 shrink-0 flex-col border-r border-gray-200 bg-white">
      <div className="border-b px-3 py-2">
        <div className="flex items-center gap-1.5">
          <ListChecks className="h-3.5 w-3.5 text-gray-500" />
          <span className="text-xs font-medium text-gray-700">
            ルーブリック
          </span>
          <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600">
            {SCORING_METHOD_LABELS[scoringMethod]}
            {cropRegion.points !== null ? `・配点 ${cropRegion.points}点` : ""}
          </span>
        </div>
        <p
          className={`mt-1 text-[11px] ${choiceScene.isOpen ? "text-amber-700" : "text-gray-500"}`}
        >
          {choiceScene.isOpen
            ? "数字で当てる・外す／0 で項目を追加／Enter で次の答案／Esc で戻る"
            : "Space で選択の場面に入り、数字で項目を当てます"}
        </p>
        <p className="mt-0.5 text-[11px] text-gray-500">
          {selectedCells.length > 0
            ? `選んだ答案 ${selectedCells.length}件`
            : "答案を選ぶと、項目を当てられます"}
        </p>
      </div>

      {overriddenCount > 0 && (
        <div className="flex items-center gap-2 border-b bg-orange-50 px-3 py-1.5 text-[11px] text-orange-800">
          <span className="flex-1">
            {overriddenCount}
            件は採点キーで付けた点が項目より優先しています（手での上書き）
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-6 shrink-0 px-2 text-[11px]"
            onClick={clearOverrides}
          >
            <Undo2 className="h-3 w-3" />
            項目の点に戻す
          </Button>
        </div>
      )}

      <ol className="flex-1 space-y-1 overflow-y-auto p-2">
        {rubricItems.map((rubricItem, index) => (
          <RubricItemEntry
            key={rubricItem.id}
            rubricItem={rubricItem}
            choiceNumber={
              choiceScene.isOpen ? choiceScene.numberOf(index) : null
            }
            isFocused={choiceScene.isOpen && choiceScene.focusedIndex === index}
            appliedCount={
              selectedCells.filter((cell) =>
                cell.appliedItemIds.has(rubricItem.id)
              ).length
            }
            selectedCount={selectedCells.length}
            isFirst={index === 0}
            isLast={index === rubricItems.length - 1}
            onToggle={() => toggleItem(rubricItem.id)}
            onEdit={() => setEditorTarget({ kind: "edit", rubricItem })}
            onDelete={() => void editing.remove(rubricItem)}
            onMove={(step) => void editing.move(rubricItem, step)}
          />
        ))}
        {rubricItems.length === 0 && (
          <li className="px-1 py-2 text-[11px] text-gray-500">
            まだ項目がありません。「項目を追加」で作ります
          </li>
        )}
      </ol>

      <div className="border-t p-2">
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() =>
            setEditorTarget({ kind: "create", appliesAfterCreate: false })
          }
        >
          <Plus className="h-4 w-4" />
          項目を追加
        </Button>
      </div>

      <RubricItemEditorDialog
        open={editorTarget !== null}
        onOpenChange={(open) => {
          if (!open) setEditorTarget(null)
        }}
        rubricItem={
          editorTarget?.kind === "edit" ? editorTarget.rubricItem : null
        }
        points={cropRegion.points}
        scoringMethod={scoringMethod}
        onSubmit={(draft) =>
          editorTarget
            ? handleSubmit(editorTarget, draft)
            : Promise.resolve(false)
        }
      />
      <RubricRecalculationDialog pending={pending} onCancel={cancel} />
    </div>
  )
}
