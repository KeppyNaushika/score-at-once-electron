"use client"

import { useQuery } from "@tanstack/react-query"
import { AlertTriangle, CheckCircle2, RefreshCw, SquarePen } from "lucide-react"
import Head from "next/head"
import { useParams } from "next/navigation"
import { useMemo, useState } from "react"

import { GuardedLink } from "@/components/common/GuardedLink"
import { QuestionAssignmentRow } from "@/components/exams/08-finalize/QuestionAssignmentRow"
import { ScoreDecisionForm } from "@/components/exams/08-finalize/ScoreDecisionForm"
import { Button } from "@/components/ui/button"
import { useCurrentUser } from "@/contexts/CurrentUserContext"
import { useExamDecisionSummary } from "@/hooks/useExamDecisionSummary"
import { examDetailQuery } from "@/queries/exam"

/** 選択中セルの所在（設問とセルは必ずペアで持つ — 添字では引かない） */
interface SelectedCell {
  cropRegionId: string
  examStudentId: string
}

/**
 * 「8. 採点確定」の画面。採点の割り当てと裁定を1枚で完結させる。
 *
 * **かつては 07 の中のほぼ全画面モーダルだった。** 開き方も、ヘッダーのボタンと
 * 出力画面からの `?decide=1` の2つで、既に「URLで開く画面」になりかけていた。
 * モーダルのままだと 07 のキー操作を `modalOpen` で殺す必要があり、採点画面の
 * 状態を抱えたまま別の仕事をさせることになる。段の1つに出せばどちらも要らない。
 *
 * 左に設問行（担当・進捗・裁定対象）、右で比較・確定する。
 *
 * **担当の割り当ては 03（領域情報）の「採点担当」タブへ移した。** 設問 × 採点者の
 * 対応表なので、設問ごとに開き直さずまとめて割り当てられる。ここは食い違いを裁く
 * 画面であり、担当は「誰の採点を突き合わせているか」を読むために出しているだけである。
 */
export default function ScoreFinalizeMainView() {
  const params = useParams()
  const examId = typeof params.examId === "string" ? params.examId : ""
  const currentUser = useCurrentUser()
  const [selected, setSelected] = useState<SelectedCell | null>(null)

  // 題に出す試験名。段のヘッダーと同じキャッシュを読むので往復は増えない
  const { data: exam } = useQuery(examDetailQuery(examId))

  // この画面は裁定のために開いた画面なので、常に取る。07 が「メンバー1人なら
  // 引かない」と絞っているのは、採点のたびに全採点行を走査させないためであって、
  // ここでは引かないと画面に出すものが無くなる
  const {
    summary,
    loading,
    error,
    refresh: refreshSummary,
  } = useExamDecisionSummary(examId, currentUser.id, true)

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
    <div className="flex h-full flex-col">
      <Head>
        <title>{`採点確定 - ${exam?.examName ?? "試験"}`}</title>
      </Head>

      {/*
        この画面固有の状況と操作だけを並べる帯。段の題・使い方・次へはヘッダー
        （layout の `WorkflowTabHeader`）が出す
      */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b px-4 py-2">
        <p className="truncate text-sm text-muted-foreground">
          {summary
            ? `要裁定 ${pendingCount}件 ／ 確定済み ${summary.decidedCount}件` +
              (summary.canDecide ? "" : "（確定は試験の所有者のみ）")
            : "状況を読み込んでいます"}
        </p>
        <Button variant="outline" size="sm" onClick={refreshSummary}>
          <RefreshCw className="mr-1 h-4 w-4" />
          更新
        </Button>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* 左: 設問ごとの担当・進捗・裁定対象 */}
        <div className="w-96 shrink-0 overflow-y-auto border-r border-gray-200">
          {/* 担当を直す口は1つだけ（3. 領域情報の採点担当タブ）。ここからはそこへ送る */}
          <GuardedLink
            href={`/exams/${examId}/03-region-info`}
            className="flex items-center gap-1 border-b border-gray-100 px-3 py-2 text-xs text-blue-600 hover:underline"
          >
            <SquarePen className="h-3 w-3" />
            採点の担当を割り当てる（3. 領域情報）
          </GuardedLink>

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
              selectedCell={selectedEntry?.cell ?? null}
              onSelectCell={(cell) =>
                setSelected({
                  cropRegionId: cell.cropRegionId,
                  examStudentId: cell.examStudentId,
                })
              }
            />
          ))}
        </div>

        {/* 右: 比較と確定 */}
        <div className="min-w-0 flex-1 overflow-y-auto">
          {selectedEntry ? (
            <ScoreDecisionForm
              key={`${selectedEntry.cell.cropRegionId}:${selectedEntry.cell.examStudentId}`}
              examId={examId}
              cell={selectedEntry.cell}
              questionLabel={selectedEntry.question.questionLabel}
              maxScore={selectedEntry.question.maxScore}
              canDecide={summary?.canDecide ?? false}
              onDecided={refreshSummary}
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

      {summary && summary.conflictCount > 0 && (
        <div className="flex shrink-0 items-center gap-2 border-t border-gray-200 px-6 py-3 text-sm text-gray-600">
          <AlertTriangle className="h-4 w-4 text-purple-600" />
          <span>
            未解決の食い違い {summary.conflictCount}件（合計点が最大{" "}
            {summary.totalScoreImpact} 点低く出ます）
          </span>
        </div>
      )}
    </div>
  )
}
