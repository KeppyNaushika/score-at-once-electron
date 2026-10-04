import { useSceneCommand } from "@/components/exams/07-score-at-once/hooks/useCommand"

/** AI採点モードでだけ効かせる条件 */
export const AI_GRADING_MODE_CONDITION = "gradingMode == 'ai'"

interface UseAiAnswerNavigationShortcutsOptions {
  onPrevAnswer: () => void
  onNextAnswer: () => void
}

/**
 * AI採点モードの答案の移動（↑↓ と W/S。個別表示の「前の生徒・次の生徒」と同じキー）。
 * 設問の移動（← → と Shift+A/D）は採点画面のものがそのまま効く
 */
export function useAiAnswerNavigationShortcuts({
  onPrevAnswer,
  onNextAnswer,
}: UseAiAnswerNavigationShortcutsOptions): void {
  useSceneCommand("navigation.prevStudentArrow", onPrevAnswer, {
    condition: AI_GRADING_MODE_CONDITION,
    metadata: { title: "前の答案（↑）", category: "AI採点" },
  })
  useSceneCommand("navigation.nextStudentArrow", onNextAnswer, {
    condition: AI_GRADING_MODE_CONDITION,
    metadata: { title: "次の答案（↓）", category: "AI採点" },
  })
  useSceneCommand("navigation.moveUp", onPrevAnswer, {
    condition: AI_GRADING_MODE_CONDITION,
    metadata: { title: "前の答案", category: "AI採点" },
  })
  useSceneCommand("navigation.moveDown", onNextAnswer, {
    condition: AI_GRADING_MODE_CONDITION,
    metadata: { title: "次の答案", category: "AI採点" },
  })
}

interface UseAiAttemptShortcutsOptions {
  onPrevAttempt: () => void
  onNextAttempt: () => void
  onAdopt: () => void
}

/** 表示中の答案の試行の見比べ（`<` `>`）と採用（I） */
export function useAiAttemptShortcuts({
  onPrevAttempt,
  onNextAttempt,
  onAdopt,
}: UseAiAttemptShortcutsOptions): void {
  useSceneCommand("aiGrading.prevAttempt", onPrevAttempt, {
    condition: AI_GRADING_MODE_CONDITION,
    metadata: { title: "前の AI の判定", category: "AI採点" },
  })
  useSceneCommand("aiGrading.nextAttempt", onNextAttempt, {
    condition: AI_GRADING_MODE_CONDITION,
    metadata: { title: "次の AI の判定", category: "AI採点" },
  })
  useSceneCommand("aiGrading.adopt", onAdopt, {
    condition: AI_GRADING_MODE_CONDITION,
    metadata: { title: "AI の判定を採用", category: "AI採点" },
  })
}
