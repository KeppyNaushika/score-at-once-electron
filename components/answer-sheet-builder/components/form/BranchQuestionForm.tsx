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
  showPoints?: boolean
  maxGoUp: number
  onUpdate: (data: Partial<BranchQuestion>) => void
  onDelete: () => void
  onMoveUp?: () => void
  onMoveDown?: () => void
}

export function BranchQuestionForm({
  branch,
  showPoints = true,
  maxGoUp,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
}: BranchQuestionFormProps) {
  const [detailOpen, setDetailOpen] = useState(false)

  const hasDetailContent =
    !!branch.modelAnswer || branch.textElements.length > 0

  const goUpActive = branch.goUp != null
  const isGoUpInvalid =
    goUpActive &&
    (!Number.isInteger(branch.goUp) ||
      branch.goUp! < 1 ||
      branch.goUp! > maxGoUp)

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
          {/* 幅 (layoutWidth) */}
          <div className="flex items-center gap-0.5 px-1.5">
            <span className="text-muted-foreground">幅</span>
            <input
              className="focus:bg-accent/50 w-10 bg-transparent px-0.5 text-center outline-none"
              value={branch.layoutWidth ?? ""}
              onChange={(e) => {
                const v = e.target.value.trim()
                if (v === "") {
                  onUpdate({
                    layoutWidth: undefined,
                    nextPlacement: undefined,
                    goUp: undefined,
                  })
                } else {
                  onUpdate({ layoutWidth: v })
                }
              }}
              placeholder="—"
            />
          </div>
        </div>
        {/* 改行ボタン */}
        {branch.layoutWidth && (
          <Button
            variant="outline"
            size="icon"
            className={`h-7 w-7 text-xs ${branch.nextPlacement === "break" ? "bg-primary/10 text-primary border-primary/50 hover:bg-primary/20" : "text-muted-foreground"}`}
            onClick={() => {
              if (branch.nextPlacement === "break") {
                onUpdate({ nextPlacement: undefined })
              } else {
                onUpdate({ nextPlacement: "break" })
              }
            }}
            title="改行"
          >
            ↵
          </Button>
        )}
        {/* 戻るボタン（自分自身をN行上に配置） */}
        {branch.layoutWidth && (
          <div className="inline-flex items-center gap-0">
            <Button
              variant="outline"
              size="icon"
              className={`h-7 w-7 text-xs ${goUpActive && branch.goUp! > 0 ? "bg-primary/10 text-primary border-primary/50 hover:bg-primary/20" : "text-muted-foreground"} ${goUpActive ? "rounded-r-none" : ""}`}
              onClick={() => {
                if (goUpActive) {
                  onUpdate({ goUp: undefined })
                } else {
                  onUpdate({ goUp: Math.min(1, maxGoUp) })
                }
              }}
              disabled={!goUpActive && maxGoUp < 1}
              title={
                maxGoUp < 1
                  ? "戻れる行がありません"
                  : `N行上に戻して配置 (最大${maxGoUp})`
              }
            >
              ↑
            </Button>
            {goUpActive && (
              <input
                type="number"
                aria-label="戻り行数"
                className={`border-primary/50 h-7 w-8 [appearance:textfield] rounded-r-md border border-l-0 px-0.5 text-center text-xs outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${isGoUpInvalid ? "bg-red-100 dark:bg-red-900/30" : "bg-transparent"}`}
                value={branch.goUp || ""}
                min={1}
                max={maxGoUp}
                onChange={(e) => {
                  const v = e.target.value
                  if (v === "") {
                    onUpdate({ goUp: 0 })
                  } else {
                    onUpdate({ goUp: Number(v) })
                  }
                }}
                onBlur={() => {
                  if (
                    branch.goUp == null ||
                    !Number.isInteger(branch.goUp) ||
                    branch.goUp < 1 ||
                    branch.goUp > maxGoUp
                  ) {
                    onUpdate({ goUp: undefined })
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                    e.preventDefault()
                    const cur = branch.goUp ?? 0
                    const next = e.key === "ArrowUp" ? cur + 1 : cur - 1
                    if (next >= 1 && next <= maxGoUp) {
                      onUpdate({ goUp: next })
                    }
                  }
                }}
              />
            )}
          </div>
        )}
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
