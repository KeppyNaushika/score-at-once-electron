"use client"

import PartialScoreModal from "@/components/exams/07-score-at-once/ScoringMain/PartialScoreModal"

import { MAX_SCORE } from "./constants"
import type { DemoStatus } from "./types"
import type { DemoScoring } from "./useDemoScoring"

/** 採点体験デモの部分点入力。本番のモーダルをそのまま再利用する */
export function DemoPartialScoreModal({
  scoring,
  rawKeys,
}: {
  scoring: DemoScoring
  rawKeys: Record<DemoStatus, string>
}) {
  return (
    <PartialScoreModal
      isOpen={scoring.partial.active}
      value={scoring.partial.value}
      maxPoints={MAX_SCORE}
      questionLabel="1"
      onClose={scoring.cancelPartial}
      onChange={scoring.setPartialValue}
      onConfirmPartial={scoring.confirmPartial}
      onConfirmPending={scoring.confirmPending}
      onDigit={(digit) => scoring.editPartial(digit)}
      onBackspace={() => scoring.editPartial("⌫")}
      keyBindings={{
        partialKey: rawKeys.partial,
        pendingKey: rawKeys.pending,
        cancelKey: "Escape",
      }}
    />
  )
}
