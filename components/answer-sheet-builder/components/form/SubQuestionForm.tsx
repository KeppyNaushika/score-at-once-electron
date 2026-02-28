"use client"

import {
  ChevronDown,
  ChevronUp,
  GitBranch,
  Settings2,
  Trash2,
} from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import type {
  BranchQuestion,
  SubQuestion,
} from "@/types/answerSheetBuilder.types"

import { BranchQuestionForm } from "./BranchQuestionForm"
import { ManuscriptPaperSettings } from "./ManuscriptPaperSettings"
import { ModelAnswerEditor } from "./ModelAnswerEditor"
import { OMRCellConfigForm } from "./OMRCellConfigForm"
import { TextElementEditor } from "./TextElementEditor"

interface SubQuestionFormProps {
  sub: SubQuestion
  majorIndex: number
  subIndex: number
  totalSubCount: number
  isHorizontal?: boolean
  onUpdate: (data: Partial<SubQuestion>) => void
  onDelete: () => void
  onMoveUp?: () => void
  onMoveDown?: () => void
  onAddBranch: () => void
  onUpdateBranch: (branchIndex: number, data: Partial<BranchQuestion>) => void
  onDeleteBranch: (branchIndex: number) => void
  onReorderBranch: (fromIndex: number, toIndex: number) => void
}

export function SubQuestionForm({
  sub,
  isHorizontal,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
  onAddBranch,
  onUpdateBranch,
  onDeleteBranch,
  onReorderBranch,
}: SubQuestionFormProps) {
  const hasBranches = sub.branchQuestions.length > 0
  const [detailOpen, setDetailOpen] = useState(false)

  const hasDetailContent =
    !!sub.modelAnswer ||
    sub.textElements.length > 0 ||
    !!sub.manuscriptPaper?.enabled

  return (
    <div className="border-primary/30 space-y-1 border-l-2 pl-4">
      {/* 小問ヘッダー */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex h-7 items-center divide-x overflow-hidden rounded-md border text-xs">
          <div className="flex items-center gap-0.5 px-1.5">
            <span className="text-muted-foreground">番号</span>
            <input
              className="focus:bg-accent/50 w-10 bg-transparent px-0.5 text-center outline-none"
              value={sub.label}
              onChange={(e) => onUpdate({ label: e.target.value })}
              placeholder=""
            />
          </div>
          {/* 配点: 枝問なし or 完答モード(usesBranchPoints=false)の時に表示 */}
          {(!hasBranches || sub.usesBranchPoints === false) && (
            <div className="flex items-center gap-0.5 px-1.5">
              <span className="text-muted-foreground">配点</span>
              <input
                type="number"
                className="focus:bg-accent/50 w-9 [appearance:textfield] bg-transparent px-0.5 text-center outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                value={sub.points}
                min={0}
                max={100}
                onChange={(e) => onUpdate({ points: Number(e.target.value) })}
                onBlur={(e) => {
                  e.target.value = String(Number(e.target.value))
                }}
              />
            </div>
          )}
          {!hasBranches && (
            <>
              <div className="flex items-center gap-0.5 px-1.5">
                <span className="text-muted-foreground">高さ</span>
                <input
                  type="number"
                  className="focus:bg-accent/50 w-9 [appearance:textfield] bg-transparent px-0.5 text-center outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  value={sub.heightMultiplier}
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
                    value={sub.colSpan ?? 1}
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
            </>
          )}
        </div>

        {/* 枝問配点スイッチ（枝問がある場合のみ） */}
        {hasBranches && (
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground text-xs whitespace-nowrap">
              枝問配点
            </span>
            <Switch
              className="scale-75"
              checked={sub.usesBranchPoints !== false}
              onCheckedChange={(v) => onUpdate({ usesBranchPoints: v })}
            />
          </div>
        )}

        {/* アクションボタン */}
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
          {!hasBranches && (
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
          )}
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-primary h-7 w-7"
            onClick={onAddBranch}
            title="枝問を追加"
          >
            <GitBranch className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-destructive h-7 w-7"
            onClick={onDelete}
            title="小問を削除"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* 枝問なし: 詳細設定（展開コンテンツ） */}
      {!hasBranches && detailOpen && (
        <div className="space-y-2 pt-1">
          <ModelAnswerEditor
            value={sub.modelAnswer}
            onChange={(v) => onUpdate({ modelAnswer: v })}
          />
          <TextElementEditor
            textElements={sub.textElements}
            onUpdate={(elements) => onUpdate({ textElements: elements })}
          />
          <ManuscriptPaperSettings
            config={sub.manuscriptPaper}
            onUpdate={(config) => onUpdate({ manuscriptPaper: config })}
          />
          <OMRCellConfigForm
            config={sub.omrConfig}
            onChange={(config) => onUpdate({ omrConfig: config })}
          />
        </div>
      )}

      {/* 枝問横配置設定 */}
      {hasBranches && (
        <div className="flex items-center gap-1.5 pl-1">
          <Label className="text-muted-foreground text-xs whitespace-nowrap">
            枝問横配置
          </Label>
          <Input
            className="h-7 w-24 text-xs"
            value={sub.branchHorizontalColumnsPerRow?.join(",") ?? ""}
            onChange={(e) => {
              const val = e.target.value.trim()
              if (val === "") {
                onUpdate({ branchHorizontalColumnsPerRow: undefined })
              } else {
                const nums = val
                  .split(",")
                  .map((s) => parseInt(s.trim(), 10))
                  .filter((n) => !isNaN(n) && n > 0)
                onUpdate({
                  branchHorizontalColumnsPerRow:
                    nums.length > 0 ? nums : undefined,
                })
              }
            }}
            placeholder="空欄=縦"
            title="枝問の横配置列数をコンマ区切りで指定。例:「3」→3列1行。空欄→全て縦配置。"
          />
        </div>
      )}

      {/* 枝問リスト */}
      {hasBranches && (
        <div className="space-y-0.5">
          {sub.branchQuestions.map((branch, bi) => (
            <BranchQuestionForm
              key={branch.id}
              branch={branch}
              branchIndex={bi}
              totalBranchCount={sub.branchQuestions.length}
              isHorizontal={!!sub.branchHorizontalColumnsPerRow?.length}
              showPoints={sub.usesBranchPoints !== false}
              onUpdate={(data) => onUpdateBranch(bi, data)}
              onDelete={() => onDeleteBranch(bi)}
              onMoveUp={bi > 0 ? () => onReorderBranch(bi, bi - 1) : undefined}
              onMoveDown={
                bi < sub.branchQuestions.length - 1
                  ? () => onReorderBranch(bi, bi + 1)
                  : undefined
              }
            />
          ))}
        </div>
      )}
    </div>
  )
}
