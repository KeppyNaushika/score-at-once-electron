"use client"

import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import type {
  BranchQuestion,
  MajorQuestion,
  SubQuestion,
} from "@/types/answerSheetBuilder.types"

import { MajorQuestionForm } from "./MajorQuestionForm"

interface QuestionListEditorProps {
  majorQuestions: MajorQuestion[]
  onAddMajor: () => void
  onUpdateMajor: (index: number, data: Partial<MajorQuestion>) => void
  onDeleteMajor: (index: number) => void
  onAddSub: (majorIndex: number) => void
  onUpdateSub: (
    majorIndex: number,
    subIndex: number,
    data: Partial<SubQuestion>
  ) => void
  onDeleteSub: (majorIndex: number, subIndex: number) => void
  onAddBranch: (majorIndex: number, subIndex: number) => void
  onUpdateBranch: (
    majorIndex: number,
    subIndex: number,
    branchIndex: number,
    data: Partial<BranchQuestion>
  ) => void
  onDeleteBranch: (
    majorIndex: number,
    subIndex: number,
    branchIndex: number
  ) => void
}

export function QuestionListEditor({
  majorQuestions,
  onAddMajor,
  onUpdateMajor,
  onDeleteMajor,
  onAddSub,
  onUpdateSub,
  onDeleteSub,
  onAddBranch,
  onUpdateBranch,
  onDeleteBranch,
}: QuestionListEditorProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-muted-foreground text-sm font-semibold">
          問題構成
        </h3>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={onAddMajor}
        >
          <Plus className="mr-1 h-3 w-3" />
          大問追加
        </Button>
      </div>

      <div className="space-y-2">
        {majorQuestions.map((major, mi) => (
          <MajorQuestionForm
            key={major.id}
            major={major}
            majorIndex={mi}
            onUpdate={(data) => onUpdateMajor(mi, data)}
            onDelete={() => onDeleteMajor(mi)}
            onAddSub={() => onAddSub(mi)}
            onUpdateSub={(si, data) => onUpdateSub(mi, si, data)}
            onDeleteSub={(si) => onDeleteSub(mi, si)}
            onAddBranch={(si) => onAddBranch(mi, si)}
            onUpdateBranch={(si, bi, data) => onUpdateBranch(mi, si, bi, data)}
            onDeleteBranch={(si, bi) => onDeleteBranch(mi, si, bi)}
          />
        ))}
      </div>

      {majorQuestions.length === 0 && (
        <div className="text-muted-foreground py-8 text-center text-sm">
          大問がありません。「大問追加」ボタンで追加してください。
        </div>
      )}
    </div>
  )
}
