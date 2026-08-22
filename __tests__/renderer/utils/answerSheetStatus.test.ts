/**
 * 解答用紙の「次のステップ」導出の固定。
 *
 * 一覧の各行に「次にやること」を1つだけ出すので、段の進み具合ごとに
 * どこを指すかがずれると、利用者は毎回間違った画面へ連れて行かれる。
 *
 * 飛び先の URL は**手で書かない**。段のフォルダ名が変わっても文字列の期待値は
 * 一緒に変わらないので、テストは緑のままリンクだけが 404 になる。
 * 期待値は `src/app` の実在するディレクトリから引く。
 */
import * as fs from "fs"
import * as path from "path"
import { describe, expect, it } from "vitest"

import { getAnswerSheetStatus } from "@/lib/answerSheetStatus"

const REPO_ROOT = path.resolve(__dirname, "../../..")
const ANSWER_SHEET_ROUTE_DIR = path.join(
  REPO_ROOT,
  "src/app/(app)/answer-sheet-builder/[definitionId]"
)

/** 実在する段のディレクトリ（`NN-*`）を段番号で引く表 */
const stepSegmentByNumber = new Map<number, string>(
  fs
    .readdirSync(ANSWER_SHEET_ROUTE_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d{2}-/.test(entry.name))
    .map((entry) => [Number(entry.name.slice(0, 2)), entry.name])
)

const DEFINITION_ID = "definition-1"

/** 段番号から、その段の実在するパスを組む */
function urlOfStep(step: number): string {
  const segment = stepSegmentByNumber.get(step)
  if (!segment) {
    throw new Error(
      `段 ${step} のページが ${ANSWER_SHEET_ROUTE_DIR} に見つかりません`
    )
  }
  return `/answer-sheet-builder/${DEFINITION_ID}/${segment}`
}

describe("getAnswerSheetStatus", () => {
  it("解答用紙のワークフローは 01〜02 の2段である", () => {
    // 段が増減したらここが落ちる（次のステップの導出も見直しが要る）
    expect([...stepSegmentByNumber.keys()].sort()).toEqual([1, 2])
  })

  it("設問が1問も無いときは作成を指す", () => {
    const status = getAnswerSheetStatus({
      id: DEFINITION_ID,
      questionCount: 0,
    })

    expect(status.step).toBe(1)
    expect(status.text).toBe("解答用紙の作成")
    expect(status.url).toBe(urlOfStep(1))
  })

  it("設問数が届いていないときも作成を指す", () => {
    // 一覧の行では省略されうる（`questionCount?: number`）。無い＝0問として扱う
    const status = getAnswerSheetStatus({ id: DEFINITION_ID })

    expect(status.step).toBe(1)
    expect(status.url).toBe(urlOfStep(1))
  })

  it("設問があれば書き出しを指し続ける", () => {
    const status = getAnswerSheetStatus({
      id: DEFINITION_ID,
      questionCount: 12,
    })

    expect(status.step).toBe(2)
    expect(status.text).toBe("解答用紙の書き出し")
    expect(status.url).toBe(urlOfStep(2))
  })
})
