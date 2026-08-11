"use client"

import { AlertTriangle, CheckCircle2, Gavel, RefreshCw } from "lucide-react"
import { useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { ExamDecisionSummary } from "@/types/scoreDecision.types"

import { QuestionAssignmentRow } from "./QuestionAssignmentRow"
import { ScoreDecisionForm } from "./ScoreDecisionForm"

interface ScoreDecisionPanelProps {
  isOpen: boolean
  onClose: () => void
  summary: ExamDecisionSummary | null
  loading: boolean
  error: string | null
  /** 確定後・手動更新でサマリを取り直す */
  onRefresh: () => void
  /** 担当割当の変更後（サマリと採点画面の設問集合の両方を取り直す） */
  onAssignmentChanged: () => void
}

/** 選択中セルの所在（設問とセルは必ずペアで持つ — 添字では引かない） */
interface SelectedCell {
  cropRegionId: string
  examStudentId: string
}

/**
 * 採点の割り当てと確定パネル。
 *
 * 左に設問行（担当・進捗・裁定対象）、右で比較・確定する。モーダルの入れ子を
 * 作らず、誰に割り当てるか／どこまで進んだか／何を裁定するかを1枚で完結させる。
 */
export function ScoreDecisionPanel({
  isOpen,
  onClose,
  summary,
  loading,
  error,
  onRefresh,
  onAssignmentChanged,
}: ScoreDecisionPanelProps) {
  const [selected, setSelected] = useState<SelectedCell | null>(null)

  const cellEntries = useMemo(
    () =>
      (summary?.questions ?? []).flatMap((question) =>
        question.cells.map((cell) => ({ question, cell }))
      ),
    [summary]
  )

  // 未選択、または裁定済みで対象から消えたら先頭へ寄せる。選択は「利用者が選んだ
  // セル」だけを持ち、実際に表示する対象はそこから引き直す（消えたセルを状態に
  // 書き戻すと、裁定のたびに再描画が二重に走る）
  const selectedEntry = useMemo(
    () =>
      cellEntries.find(
        (entry) =>
          entry.cell.cropRegionId === selected?.cropRegionId &&
          entry.cell.examStudentId === selected?.examStudentId
      ) ??
      cellEntries[0] ??
      null,
    [cellEntries, selected]
  )

  const pendingCount =
    (summary?.conflictCount ?? 0) + (summary?.staleCount ?? 0)

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      {/* 幅は sm: 付きで指定する。DialogContent の基底が sm:max-w-lg を持つため、
          修飾なしの max-w-* はメディアクエリ側に負けて 32rem に潰れる */}
      <DialogContent className="flex h-[85vh] w-[92vw] flex-col gap-0 p-0 sm:max-w-none">
        <DialogHeader className="border-b border-gray-200 px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            <Gavel className="h-5 w-5" />
            採点の割り当てと確定
          </DialogTitle>
          <DialogDescription>
            {summary
              ? `要裁定 ${pendingCount}件 ／ 確定済み ${summary.decidedCount}件` +
                (summary.canDecide
                  ? ""
                  : "（担当の変更と確定は試験の所有者のみ）")
              : "状況を読み込んでいます"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1">
          {/* 左: 設問ごとの担当・進捗・裁定対象 */}
          <div className="w-96 shrink-0 overflow-y-auto border-r border-gray-200">
            {loading && (
              <div className="p-4 text-sm text-gray-500">読み込み中...</div>
            )}
            {error && <div className="p-4 text-sm text-red-600">{error}</div>}

            {!loading && !error && (summary?.questions.length ?? 0) === 0 && (
              <div className="p-4 text-sm text-gray-500">
                採点領域がまだありません。
              </div>
            )}

            {(summary?.questions ?? []).map((question) => (
              <QuestionAssignmentRow
                key={question.cropRegionId}
                question={question}
                members={summary?.members ?? []}
                canManage={summary?.canDecide ?? false}
                selectedCell={selectedEntry?.cell ?? null}
                onSelectCell={(cell) =>
                  setSelected({
                    cropRegionId: cell.cropRegionId,
                    examStudentId: cell.examStudentId,
                  })
                }
                onAssignmentChanged={onAssignmentChanged}
              />
            ))}
          </div>

          {/* 右: 比較と確定 */}
          <div className="min-w-0 flex-1">
            {selectedEntry ? (
              <ScoreDecisionForm
                key={`${selectedEntry.cell.cropRegionId}:${selectedEntry.cell.examStudentId}`}
                cell={selectedEntry.cell}
                questionLabel={selectedEntry.question.questionLabel}
                maxScore={selectedEntry.question.maxScore}
                canDecide={summary?.canDecide ?? false}
                onDecided={onRefresh}
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-sm text-gray-500">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
                <p>裁定が必要な採点はありません。</p>
                <p className="text-xs">
                  採点者の結果が一致しているセルは確定なしで出力されます。
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-gray-200 px-6 py-3">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            {summary && summary.conflictCount > 0 && (
              <>
                <AlertTriangle className="h-4 w-4 text-purple-600" />
                <span>
                  未解決の食い違い {summary.conflictCount}件（合計点が最大{" "}
                  {summary.totalScoreImpact} 点低く出ます）
                </span>
              </>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onRefresh}>
              <RefreshCw className="mr-1 h-4 w-4" />
              更新
            </Button>
            <Button variant="outline" size="sm" onClick={onClose}>
              閉じる
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
