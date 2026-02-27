"use client"

import { FolderOpen } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { AnswerSheetDefinition } from "@/types/answerSheetBuilder.types"

import { useProjectIntegration } from "../../hooks/useProjectIntegration"

interface ProjectIntegrationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  definition: AnswerSheetDefinition
  totalQuestions: number
  totalPoints: number
}

export function ProjectIntegrationDialog({
  open,
  onOpenChange,
  definition,
  totalQuestions,
  totalPoints,
}: ProjectIntegrationDialogProps) {
  const { convertToProject, isConverting } = useProjectIntegration()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>採点プロジェクトに変換</DialogTitle>
          <DialogDescription>
            この解答用紙定義から採点プロジェクトを作成します。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-3">
          <div className="space-y-2 rounded-md border p-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">プロジェクト名</span>
              <span className="font-medium">{definition.name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">用紙</span>
              <span>
                {definition.settings.paperSize}{" "}
                {definition.settings.orientation === "portrait" ? "縦" : "横"}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">設問数</span>
              <span>{totalQuestions}問</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">合計配点</span>
              <span>{totalPoints}点</span>
            </div>
          </div>

          <div className="text-muted-foreground space-y-1 text-xs">
            <p>以下が自動作成されます:</p>
            <ul className="list-disc space-y-0.5 pl-4">
              <li>模範解答画像（PNG）</li>
              <li>採点領域（CropRegion）× {totalQuestions}件</li>
              <li>配点設定</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isConverting}
          >
            キャンセル
          </Button>
          <Button
            onClick={() => {
              convertToProject(definition)
              onOpenChange(false)
            }}
            disabled={isConverting}
          >
            <FolderOpen className="mr-2 h-4 w-4" />
            {isConverting ? "変換中..." : "プロジェクト作成"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
