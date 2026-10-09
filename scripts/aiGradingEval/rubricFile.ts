/**
 * 次の往復の測定に使う、ルーブリック項目のファイルの形と読み書き。
 *
 * 2段目の案を「教員が推奨の選択肢を選んだ」として項目にしたもの
 * （`buildRubricFromStage2.ts` が書き、`runStage1.ts --rubric-file` が読む）。
 * 項目ごとに、2段目がその案に入れた答案（ExamStudent の uuid）を持つ。氏名は持たない。
 */

import * as fs from "fs"

import type { RubricItemForPrompt } from "../../src/types/rubric.types"

export interface RubricFileQuestion {
  label: string
  points: number | null
  items: RubricItemForPrompt[]
  /** 項目 id → 2段目がその案に入れた答案 */
  memberExamStudentIds: Record<string, string[]>
}

/** cropRegionId → 設問の項目 */
export type RubricFile = Record<string, RubricFileQuestion>

export function readRubricFile(filePath: string): RubricFile {
  const parsed: RubricFile = JSON.parse(fs.readFileSync(filePath, "utf8"))
  return parsed
}
