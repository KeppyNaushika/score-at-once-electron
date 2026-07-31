"use client"

import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Plus,
  Trash2,
} from "lucide-react"
import { useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type {
  BranchQuestion,
  MajorQuestion,
  SubQuestion,
} from "@/types/answerSheetDefinition.types"

import { SubQuestionForm } from "./SubQuestionForm"

/** 簡易分数パース (例: "1/3" → 0.333) */
function parseFractionSimple(fraction: string): number {
  const match = fraction.match(/^(\d+)\/(\d+)$/)
  if (match) return parseInt(match[1]) / parseInt(match[2])
  const parsed = parseFloat(fraction)
  return isNaN(parsed) ? 1 : parsed
}

/** 各小問の maxGoUp (= その小問の goUp 適用前の行インデックス) を計算 */
function calcSubMaxGoUps(subs: SubQuestion[]): number[] {
  const result: number[] = []
  let row = 0
  let curX = 0
  for (let i = 0; i < subs.length; i++) {
    const subQuestion = subs[i]
    const w = parseFractionSimple(subQuestion.layoutWidth ?? "1")

    // auto-break: 前の要素の配置結果で現在行に収まらない場合
    if (curX > 1e-9 && curX + w > 1 + 1e-9) {
      row++
      curX = 0
    }

    // maxGoUp = goUp 適用前の行インデックス
    result.push(row)

    // goUp 適用
    if (subQuestion.goUp != null && subQuestion.goUp > 0) {
      row = Math.max(0, row - subQuestion.goUp)
      curX = 0.5
    }

    curX += w

    if (subQuestion.nextPlacement === "break") {
      row++
      curX = 0
    }
  }
  return result
}

interface MajorQuestionFormProps {
  major: MajorQuestion
  majorIndex: number
  totalMajorCount: number
  definitionId: string
  onUpdate: (data: Partial<MajorQuestion>) => void
  onDelete: () => void
  onMoveUp?: () => void
  onMoveDown?: () => void
  onAddSub: () => void
  onUpdateSub: (subIndex: number, data: Partial<SubQuestion>) => void
  onDeleteSub: (subIndex: number) => void
  onReorderSub: (fromIndex: number, toIndex: number) => void
  onAddBranch: (subIndex: number) => void
  onUpdateBranch: (
    subIndex: number,
    branchIndex: number,
    data: Partial<BranchQuestion>
  ) => void
  onDeleteBranch: (subIndex: number, branchIndex: number) => void
  onReorderBranch: (
    subIndex: number,
    fromIndex: number,
    toIndex: number
  ) => void
  /** 縦書きレイアウトか（高さ/幅ラベルの表示を入れ替える） */
  vertical?: boolean
}

export function MajorQuestionForm({
  major,
  majorIndex,
  definitionId,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
  onAddSub,
  onUpdateSub,
  onDeleteSub,
  onReorderSub,
  onAddBranch,
  onUpdateBranch,
  onDeleteBranch,
  onReorderBranch,
  vertical = false,
}: MajorQuestionFormProps) {
  const [isOpen, setIsOpen] = useState(true)

  const subMaxGoUps = useMemo(
    () => calcSubMaxGoUps(major.subQuestions),
    [major.subQuestions]
  )

  return (
    <div className="rounded-lg border bg-muted/30">
      {/* ── ヘッダーバー ── */}
      <div className="flex items-center gap-2 px-3 py-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </Button>
        <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-semibold whitespace-nowrap text-primary">
          大問 {majorIndex + 1}
        </span>
        <Input
          className="h-7 w-20 text-xs"
          value={major.label}
          onChange={(e) => onUpdate({ label: e.target.value })}
          placeholder=""
        />
        <div className="ml-auto flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={onAddSub}
            title="小問を追加"
          >
            <Plus className="mr-1 h-3 w-3" />
            小問
          </Button>
          <div className="inline-flex items-center rounded-md border">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-r-none text-muted-foreground"
              onClick={onMoveUp}
              disabled={!onMoveUp}
              title="上へ移動"
            >
              <ChevronUp className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-l-none border-l text-muted-foreground"
              onClick={onMoveDown}
              disabled={!onMoveDown}
              title="下へ移動"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={onDelete}
            title="大問を削除"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* ── 展開コンテンツ ── */}
      {isOpen && (
        <div className="space-y-3 border-t px-3 pt-2 pb-3">
          {/* 小問リスト */}
          {major.subQuestions.length > 0 && (
            <div className="space-y-2 pl-2">
              {major.subQuestions.map((subQuestion, si) => (
                <SubQuestionForm
                  key={subQuestion.id}
                  sub={subQuestion}
                  majorIndex={majorIndex}
                  subIndex={si}
                  totalSubCount={major.subQuestions.length}
                  maxGoUp={subMaxGoUps[si]}
                  definitionId={definitionId}
                  onUpdate={(data) => onUpdateSub(si, data)}
                  onDelete={() => onDeleteSub(si)}
                  onMoveUp={si > 0 ? () => onReorderSub(si, si - 1) : undefined}
                  onMoveDown={
                    si < major.subQuestions.length - 1
                      ? () => onReorderSub(si, si + 1)
                      : undefined
                  }
                  onAddBranch={() => onAddBranch(si)}
                  onUpdateBranch={(bi, data) => onUpdateBranch(si, bi, data)}
                  onDeleteBranch={(bi) => onDeleteBranch(si, bi)}
                  onReorderBranch={(from, to) => onReorderBranch(si, from, to)}
                  vertical={vertical}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
