import { useState } from "react"

import type { AiGridViewSettings } from "../types"
import {
  type AiGridFilterSettings,
  DEFAULT_AI_GRID_FILTER_SETTINGS,
} from "../utils/aiGridFilter"
import type { AnswerOrder } from "../utils/answerReview"

/**
 * AI採点モードの一覧の絞り込みと並べ方。
 *
 * 設問を切り替えても変えない（一覧表示の絞り込みが設問をまたいで残るのと同じ）。作業場は
 * 設問ごとに作り直されるので、ここは作り直されない AI採点モードの根で使う。
 * 保存はしない（モードを切り替えるか画面を開き直すと既定に戻る。一覧表示の絞り込みと同じ）
 */
export function useAiGridViewSettings(): AiGridViewSettings {
  const [filterSettings, setFilterSettings] = useState<AiGridFilterSettings>(
    DEFAULT_AI_GRID_FILTER_SETTINGS
  )
  const [answerOrder, setAnswerOrder] = useState<AnswerOrder>("display")
  return { filterSettings, setFilterSettings, answerOrder, setAnswerOrder }
}
