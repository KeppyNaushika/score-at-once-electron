"use client"

import { GitBranch, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type {
  BranchQuestion,
  SubQuestion,
} from "@/types/answerSheetBuilder.types"

import { BranchQuestionForm } from "./BranchQuestionForm"
import { ManuscriptPaperSettings } from "./ManuscriptPaperSettings"
import { ModelAnswerEditor } from "./ModelAnswerEditor"
import { TextElementEditor } from "./TextElementEditor"

interface SubQuestionFormProps {
  sub: SubQuestion
  majorIndex: number
  subIndex: number
  isHorizontalLayout?: boolean
  onUpdate: (data: Partial<SubQuestion>) => void
  onDelete: () => void
  onAddBranch: () => void
  onUpdateBranch: (branchIndex: number, data: Partial<BranchQuestion>) => void
  onDeleteBranch: (branchIndex: number) => void
}

export function SubQuestionForm({
  sub,
  isHorizontalLayout,
  onUpdate,
  onDelete,
  onAddBranch,
  onUpdateBranch,
  onDeleteBranch,
}: SubQuestionFormProps) {
  const hasBranches = sub.branchQuestions.length > 0

  return (
    <div className="border-muted space-y-1 border-l-2 pl-4">
      {/* 小問ヘッダー */}
      <div className="flex flex-wrap items-center gap-1.5">
        <Input
          className="h-7 w-14 text-xs"
          value={sub.label}
          onChange={(e) => onUpdate({ label: e.target.value })}
          placeholder="ラベル"
        />
        {!hasBranches && (
          <>
            <div className="flex items-center gap-1">
              <Label className="text-muted-foreground text-[10px] whitespace-nowrap">
                高さ×
              </Label>
              <Input
                type="number"
                className="h-7 w-12 text-xs"
                value={sub.heightMultiplier}
                min={1}
                max={10}
                step={0.5}
                onChange={(e) =>
                  onUpdate({ heightMultiplier: Number(e.target.value) })
                }
              />
            </div>
            {isHorizontalLayout && (
              <div className="flex items-center gap-1">
                <Label className="text-muted-foreground text-[10px] whitespace-nowrap">
                  列幅×
                </Label>
                <Input
                  type="number"
                  className="h-7 w-12 text-xs"
                  value={sub.colSpan ?? 1}
                  min={1}
                  max={10}
                  step={1}
                  onChange={(e) =>
                    onUpdate({ colSpan: Number(e.target.value) || 1 })
                  }
                />
              </div>
            )}
            <div className="flex items-center gap-1">
              <Label className="text-muted-foreground text-[10px] whitespace-nowrap">
                配点
              </Label>
              <Input
                type="number"
                className="h-7 w-12 text-xs"
                value={sub.points}
                min={0}
                max={100}
                onChange={(e) => onUpdate({ points: Number(e.target.value) })}
              />
            </div>
          </>
        )}
        <div className="flex gap-0.5">
          {!isHorizontalLayout && (
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-primary h-6 w-6"
              onClick={onAddBranch}
              title="枝問を追加"
            >
              <GitBranch className="h-3 w-3" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-destructive h-6 w-6"
            onClick={onDelete}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* 枝問なし: 詳細設定 */}
      {!hasBranches && (
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
        </div>
      )}

      {/* 枝問リスト */}
      {hasBranches && (
        <div className="space-y-0.5">
          {sub.branchQuestions.map((branch, bi) => (
            <BranchQuestionForm
              key={branch.id}
              branch={branch}
              onUpdate={(data) => onUpdateBranch(bi, data)}
              onDelete={() => onDeleteBranch(bi)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
