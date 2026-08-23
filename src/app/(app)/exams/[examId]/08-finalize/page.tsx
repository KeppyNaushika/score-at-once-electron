"use client"

import ScoreFinalizeMainView from "@/components/exams/08-finalize/ScoreFinalizeMainView"

export default function ScoreFinalizePage() {
  // 誰が確定したかを控えるので、操作者が分からないまま書かせない
  // （`useCurrentUser` が居なければログインへ戻す）
  return <ScoreFinalizeMainView />
}
