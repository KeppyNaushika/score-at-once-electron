"use client"

import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Gavel,
} from "lucide-react"
import { useState } from "react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { SCORING_STATUS_LABELS } from "@/lib/scoringStatusColors"
import type {
  ConflictWarning,
  QuestionWarning,
  ScoringValidationWarnings,
} from "@/types/exportValidation.types"

interface ExportWarningModalProps {
  isOpen: boolean
  onClose: () => void
  onContinue: () => void
  /** 「8. 採点確定」の段へ誘導する。競合があるときだけ表示される */
  onGoToFinalize: () => void
  warnings: ScoringValidationWarnings
  /** 食い違いを未解決のまま出力した場合に合計点から失われる最大値 */
  conflictScoreImpact: number
  /** 食い違いの検査自体に失敗した理由（この場合 conflicted は当てにならない） */
  conflictCheckError?: string
}

/** 内訳に出す生徒名。多いときは先頭だけ出して残りは件数で示す */
const MAX_LISTED_NAMES = 5

function summarizeStudentNames(studentNames: string[]): string {
  if (studentNames.length <= MAX_LISTED_NAMES) return studentNames.join("、")
  return `${studentNames.slice(0, MAX_LISTED_NAMES).join("、")} ほか${
    studentNames.length - MAX_LISTED_NAMES
  }名`
}

/** 設問ごとに集約した警告のグループ（既定は折りたたみ） */
function CollapsibleWarningGroup({
  title,
  questions,
}: {
  title: string
  questions: QuestionWarning[]
}) {
  const [isOpen, setIsOpen] = useState(false)
  const total = questions.reduce((sum, question) => sum + question.count, 0)

  if (questions.length === 0) return null

  return (
    <div className="rounded-md border border-gray-200">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-gray-50"
      >
        <span className="flex items-center gap-1 text-gray-700">
          {isOpen ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          {title}
        </span>
        <span className="font-medium text-gray-600">{total}件</span>
      </button>
      {isOpen && (
        <div className="space-y-1 border-t border-gray-100 px-3 py-2 text-sm">
          {questions.map((question) => (
            <div key={question.cropRegionId}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-gray-700">
                  {question.questionLabel}
                </span>
                <span className="shrink-0 text-gray-500">
                  {question.count}名
                </span>
              </div>
              <div className="text-xs text-gray-500">
                {summarizeStudentNames(question.studentNames)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** 対処が必要な食い違い1件の内訳（誰が何点を付けたか） */
function ConflictRow({ conflict }: { conflict: ConflictWarning }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-1">
      <span className="font-medium">{conflict.studentName}</span>
      <span className="text-purple-700">
        {conflict.questionLabel}（{conflict.maxScore}点）
      </span>
      <span className="text-purple-600">
        {conflict.proposals
          .map(
            (proposal) =>
              `${proposal.userName}: ${SCORING_STATUS_LABELS[proposal.status]} ${
                proposal.scoreValue ?? "-"
              }点`
          )
          .join(" / ")}
      </span>
    </div>
  )
}

export default function ExportWarningModal({
  isOpen,
  onClose,
  onContinue,
  onGoToFinalize,
  warnings,
  conflictScoreImpact,
  conflictCheckError,
}: ExportWarningModalProps) {
  const conflicted = warnings?.conflicted ?? []
  const hasWarnings =
    conflictCheckError !== undefined ||
    conflicted.length > 0 ||
    (warnings?.noScoringData?.length ?? 0) > 0 ||
    (warnings?.ungraded?.length ?? 0) > 0 ||
    (warnings?.missingPartialScore?.length ?? 0) > 0

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            警告
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* 食い違いを確認できなかった場合。「食い違いなし」と誤読させない */}
          {conflictCheckError !== undefined && (
            <Alert className="border-red-300 bg-red-50">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                <div className="mb-1 font-medium">
                  採点者間の食い違いを確認できませんでした
                </div>
                <div className="text-sm">
                  {conflictCheckError}
                  <br />
                  食い違いが無いことの確認は取れていません。出力し直すか、
                  採点画面の確定パネルで状況を確認してください。
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* 対処が必要: 採点者間の食い違い（値が出ない・OWNERしか直せない） */}
          {conflicted.length > 0 && (
            <Alert className="border-purple-300 bg-purple-50">
              <AlertTriangle className="h-4 w-4 text-purple-600" />
              <AlertDescription className="text-purple-800">
                <div className="mb-1 font-medium">
                  採点者間で結果が食い違っています {conflicted.length}件
                </div>
                <div className="mb-2 text-sm">
                  この設問答案は未採点として出力されます（合計点が最大{" "}
                  {conflictScoreImpact} 点低く出ます）。
                </div>
                <div className="mb-3 space-y-0.5 text-sm">
                  {conflicted.map((conflict) => (
                    <ConflictRow
                      key={`${conflict.cropRegionId}:${conflict.examStudentId}`}
                      conflict={conflict}
                    />
                  ))}
                </div>
                <Button
                  size="sm"
                  className="bg-purple-600 hover:bg-purple-700"
                  onClick={onGoToFinalize}
                >
                  <Gavel className="mr-1 h-4 w-4" />
                  採点確定のページで解決する
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* 確認: 採点途中なら正常。件数と設問別内訳だけ示す */}
          {(warnings?.noScoringData?.length ?? 0) +
            (warnings?.ungraded?.length ?? 0) +
            (warnings?.missingPartialScore?.length ?? 0) >
            0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-600">
                確認（このまま出力できます）
              </div>
              <CollapsibleWarningGroup
                title="採点データがありません"
                questions={warnings?.noScoringData ?? []}
              />
              <CollapsibleWarningGroup
                title="未採点"
                questions={warnings?.ungraded ?? []}
              />
              <CollapsibleWarningGroup
                title="部分点が入力されていません"
                questions={warnings?.missingPartialScore ?? []}
              />
            </div>
          )}

          {!hasWarnings && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                採点データに問題は見つかりませんでした。
              </AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              キャンセル
            </Button>
            <Button
              onClick={onContinue}
              className={
                hasWarnings ? "bg-orange-600 hover:bg-orange-700" : undefined
              }
            >
              {hasWarnings ? "このまま出力" : "続行"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
