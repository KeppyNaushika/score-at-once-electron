"use client"

import { useParams } from "next/navigation"

import { ScoringAnonymityProvider } from "@/components/exams/07-score-at-once/anonymity/ScoringAnonymityContext"
import ScoringMainView from "@/components/exams/07-score-at-once/ScoringMain/ScoringMainView"

export default function GradingPage() {
  const params = useParams()
  const examId = typeof params.examId === "string" ? params.examId : ""

  // 採点は利用者ごとに別々に保存する。誰が採点しているか分からないまま
  // 書かせない（操作者が居なければログインへ戻す）。
  // 匿名採点は画面全体（一覧・個別・AI 採点・手書きの一覧）に効かせるので、ここで包む
  return (
    <ScoringAnonymityProvider examId={examId}>
      <ScoringMainView />
    </ScoringAnonymityProvider>
  )
}
