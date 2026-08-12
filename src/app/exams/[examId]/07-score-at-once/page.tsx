"use client"

import ProtectedRoute from "@/components/auth/ProtectedRoute"
import ScoringMainView from "@/components/exams/07-score-at-once/ScoringMain/ScoringMainView"

export default function GradingPage() {
  // 採点は利用者ごとに別々に保存する。誰が採点しているか分からないまま
  // 書かせない（操作者が居なければログインへ戻す）
  return (
    <ProtectedRoute>
      <ScoringMainView />
    </ProtectedRoute>
  )
}
