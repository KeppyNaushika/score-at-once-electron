"use client"

import type { QuestionProgress } from "@/components/exams/07-score-at-once/ScoringData/types"
import { Progress } from "@/components/ui/progress"

interface ExamProgressCardProps {
  /** 設問ごとの採点進捗。採点画面が既に持つ採点データから算出済みのものを受け取る */
  questionProgress: QuestionProgress
}

/** 0除算を避けて百分率にする */
function toPercentage(part: number, whole: number): number {
  return whole === 0 ? 0 : (part / whole) * 100
}

/**
 * 試験全体の採点進捗。
 *
 * 自分では取得しない。設問ナビゲータが表示している設問ごとの進捗を合計するだけなので、
 * 同じ画面の中で数字が食い違うことがない。
 *
 * かつては専用IPCで試験全体の採点行を30秒ごとに読み直していたが、採点画面は既に
 * 全採点者の採点データを持っており、NAS上の共有DBへ周期的に重い問い合わせを投げる
 * 理由が無かったため取りやめた。
 */
export default function ExamProgressCard({
  questionProgress,
}: ExamProgressCardProps) {
  const questions = Object.values(questionProgress)

  if (questions.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">進捗データがありません</p>
    )
  }

  const totalItems = questions.reduce(
    (sum, question) => sum + question.totalAnswers,
    0
  )
  const scoredItems = questions.reduce(
    (sum, question) => sum + question.gradedAnswers,
    0
  )
  const finalizedItems = questions.reduce(
    (sum, question) => sum + question.finalizedAnswers,
    0
  )
  // 設問ごとの答案数は全設問で等しいので、1設問分がそのまま答案枚数になる
  const answerSheetCount = questions[0].totalAnswers
  const scoredPercentage = toPercentage(scoredItems, totalItems)
  const finalizedPercentage = toPercentage(finalizedItems, totalItems)
  const isComplete = totalItems > 0 && finalizedItems >= totalItems

  return (
    <div className="space-y-2">
      {/* 基本統計 */}
      <div className="flex items-center justify-between text-xs text-gray-600">
        <span>
          生徒 {answerSheetCount} / 設問 {questions.length} / 計 {totalItems}
          項目
        </span>
        {isComplete && (
          <span className="rounded bg-green-100 px-1 py-0.5 text-[10px] font-medium text-green-700">
            完了
          </span>
        )}
      </div>

      {/* 採点進捗 */}
      <div className="space-y-0.5">
        <div className="flex items-center justify-between text-[10px] text-gray-500">
          <span>採点</span>
          <span>
            {scoredItems}/{totalItems} ({Math.round(scoredPercentage)}%)
          </span>
        </div>
        <Progress value={scoredPercentage} className="h-1" />
      </div>

      {/* 最終確定進捗 */}
      <div className="space-y-0.5">
        <div className="flex items-center justify-between text-[10px] text-gray-500">
          <span>確定</span>
          <span>
            {finalizedItems}/{totalItems} ({Math.round(finalizedPercentage)}%)
          </span>
        </div>
        <Progress value={finalizedPercentage} className="h-1" />
      </div>
    </div>
  )
}
