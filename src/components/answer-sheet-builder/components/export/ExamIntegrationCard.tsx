"use client"

import { FolderOpen } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import type { AnswerSheetDefinition } from "@/types/answerSheetDefinition.types"

import { countAsbQuestions } from "../../answerSheetStats"
import { useMultiPageLayout } from "../../hooks/useAnswerSheetLayout"
import { ExamIntegrationDialog } from "./ExamIntegrationDialog"

interface ExamIntegrationCardProps {
  definition: AnswerSheetDefinition
}

/**
 * 解答用紙から採点試験を作成する導線。
 * 書き出しページの出力ボタン群と同じ体裁で変換ダイアログを開く。
 */
export function ExamIntegrationCard({ definition }: ExamIntegrationCardProps) {
  const [examDialogOpen, setExamDialogOpen] = useState(false)
  const multiPageLayout = useMultiPageLayout(definition)

  const totalQuestions = multiPageLayout.pages
    .flatMap((page) => page.cells)
    .filter((cell) => cell.cellType === "answer").length
  const { totalPoints } = countAsbQuestions(definition.majorQuestions)

  return (
    <>
      <Button
        variant="outline"
        className="h-12 w-full justify-start gap-3"
        onClick={() => setExamDialogOpen(true)}
      >
        <FolderOpen className="h-5 w-5 text-amber-500" />
        <div className="text-left">
          <div className="text-sm font-medium">採点試験に変換</div>
          <div className="text-xs text-muted-foreground">
            模範解答・採点領域・配点を自動作成
          </div>
        </div>
      </Button>

      <ExamIntegrationDialog
        open={examDialogOpen}
        onOpenChange={setExamDialogOpen}
        definition={definition}
        totalQuestions={totalQuestions}
        totalPoints={totalPoints}
      />
    </>
  )
}
