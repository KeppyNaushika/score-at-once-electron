import { useState } from "react"

import type { AnswerItem } from "@/components/exams/06-student-answers/types"

/**
 * ドラッグ&ドロップの状態管理（現在ドラッグ中のアクティブ対象のみ）。
 *
 * 旧来はここで「配置戦略の切替時にリストを完全再構築（buildDnDArray）」していたが、
 * upload は `useTableDataGeneration` の座標再ソート、view は座標基準配置（方式B）へ移行し、
 * この再構築は不要になった。むしろ view ではマウント時に発火して孤立答案（除籍・ページ範囲外）を
 * 配列から取りこぼし、救済ストリップごと消してしまう害があったため撤去した。
 */
export function useDragDropState<TItem extends AnswerItem>() {
  const [activeFile, setActiveFile] = useState<TItem | null>(null)

  return { activeFile, setActiveFile }
}
