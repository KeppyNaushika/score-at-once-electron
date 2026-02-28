"use client"

import { ChevronDown, ChevronUp, Settings2, Trash2 } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import type { BranchQuestion } from "@/types/answerSheetBuilder.types"

import { ModelAnswerEditor } from "./ModelAnswerEditor"
import { OMRCellConfigForm } from "./OMRCellConfigForm"
import { TextElementEditor } from "./TextElementEditor"

interface BranchQuestionFormProps {
  branch: BranchQuestion
  branchIndex: number
  totalBranchCount: number
  isHorizontal?: boolean
  showPoints?: boolean
  onUpdate: (data: Partial<BranchQuestion>) => void
  onDelete: () => void
  onMoveUp?: () => void
  onMoveDown?: () => void
}

export function BranchQuestionForm({
  branch,
  isHorizontal,
  showPoints = true,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
}: BranchQuestionFormProps) {
  const [detailOpen, setDetailOpen] = useState(false)

  const hasDetailContent =
    !!branch.modelAnswer || branch.textElements.length > 0

  return (
    <div className="border-muted-foreground/20 ml-4 space-y-1 border-l-2 py-1 pl-4">
      {/* 基本設定行 */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex h-7 items-center divide-x overflow-hidden rounded-md border text-xs">
          <div className="flex items-center gap-0.5 px-1.5">
            <span className="text-muted-foreground">番号</span>
            <input
              className="focus:bg-accent/50 w-10 bg-transparent px-0.5 text-center outline-none"
              value={branch.label}
              onChange={(e) => onUpdate({ label: e.target.value })}
              placeholder=""
            />
          </div>
          {showPoints && (
            <div className="flex items-center gap-0.5 px-1.5">
              <span className="text-muted-foreground">配点</span>
              <input
                type="number"
                className="focus:bg-accent/50 w-9 [appearance:textfield] bg-transparent px-0.5 text-center outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                value={branch.points}
                min={0}
                max={100}
                onChange={(e) => onUpdate({ points: Number(e.target.value) })}
                onBlur={(e) => {
                  e.target.value = String(Number(e.target.value))
                }}
              />
            </div>
          )}
          <div className="flex items-center gap-0.5 px-1.5">
            <span className="text-muted-foreground">高さ</span>
            <input
              type="number"
              className="focus:bg-accent/50 w-9 [appearance:textfield] bg-transparent px-0.5 text-center outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              value={branch.heightMultiplier}
              min={1}
              max={10}
              step={0.5}
              onChange={(e) =>
                onUpdate({ heightMultiplier: Number(e.target.value) })
              }
              onBlur={(e) => {
                e.target.value = String(Number(e.target.value))
              }}
            />
          </div>
          {isHorizontal && (
            <div className="flex items-center gap-0.5 px-1.5">
              <span className="text-muted-foreground">幅</span>
              <input
                type="number"
                className="focus:bg-accent/50 w-9 [appearance:textfield] bg-transparent px-0.5 text-center outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                value={branch.colSpan ?? 1}
                min={1}
                max={10}
                step={1}
                onChange={(e) =>
                  onUpdate({ colSpan: Number(e.target.value) || 1 })
                }
                onBlur={(e) => {
                  e.target.value = String(Number(e.target.value) || 1)
                }}
              />
            </div>
          )}
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <div className="inline-flex items-center rounded-md border">
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground h-7 w-7 rounded-r-none"
              onClick={onMoveUp}
              disabled={!onMoveUp}
              title="上へ移動"
            >
              <ChevronUp className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground h-7 w-7 rounded-l-none border-l"
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
            className={`relative h-7 w-7 ${detailOpen ? "text-primary" : "text-muted-foreground"}`}
            onClick={() => setDetailOpen(!detailOpen)}
            title="詳細設定"
          >
            <Settings2 className="h-3.5 w-3.5" />
            {hasDetailContent && (
              <span className="bg-primary absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-destructive h-7 w-7"
            onClick={onDelete}
            title="枝問を削除"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* 詳細設定（展開コンテンツ） */}
      {detailOpen && (
        <div className="space-y-2 pt-1">
          <ModelAnswerEditor
            value={branch.modelAnswer}
            onChange={(v) => onUpdate({ modelAnswer: v })}
          />
          <TextElementEditor
            textElements={branch.textElements}
            onUpdate={(elements) => onUpdate({ textElements: elements })}
          />
          <OMRCellConfigForm
            config={branch.omrConfig}
            onChange={(config) => onUpdate({ omrConfig: config })}
          />
        </div>
      )}
    </div>
  )
}
