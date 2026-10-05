import type { AiGridItem } from "../types"
import { neighborAttemptId } from "../utils/attemptSelection"
import { useAiAttemptShortcuts } from "./useAiGradingShortcuts"

interface UseAiAttemptNavigationOptions {
  singleSelectedItem: AiGridItem | null
  onChooseAttempt: (examStudentId: string, attemptId: string) => void
  /** 選んだ答案に反映する（I。何を反映するかは左の反映のタブで決まる） */
  onAdopt: () => void
}

/**
 * 選んだ答案の試行の見比べ（`<` `>`）と反映（I）。
 *
 * キーは左パネルのどのタブを開いていても効かせるので、タブの中身（開いていないと
 * 外される）ではなく作業場で持つ。`<` `>` は答案を1つだけ選んでいるときに効く
 */
export function useAiAttemptNavigation({
  singleSelectedItem,
  onChooseAttempt,
  onAdopt,
}: UseAiAttemptNavigationOptions) {
  const showNeighborAttempt = (direction: "older" | "newer") => {
    if (!singleSelectedItem) return
    const { answer, review } = singleSelectedItem.reviewedAnswer
    const attemptId = neighborAttemptId(
      answer.attempts,
      review.displayedAttempt?.attempt.id ?? null,
      direction
    )
    if (attemptId) onChooseAttempt(singleSelectedItem.id, attemptId)
  }
  const showOlderAttempt = () => showNeighborAttempt("older")
  const showNewerAttempt = () => showNeighborAttempt("newer")
  useAiAttemptShortcuts({
    onPrevAttempt: showOlderAttempt,
    onNextAttempt: showNewerAttempt,
    onAdopt,
  })
  return { showOlderAttempt, showNewerAttempt }
}
