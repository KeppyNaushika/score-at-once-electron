/**
 * 模範解答ファイルの名前の作り方。
 *
 * 保存先は1回しか訊かないので、模範解答側の名前はここで作る。拡張子の手前へ入れ損ねると
 * `解答用紙.pdf_模範解答` のような開けないファイルになる。
 */
import { describe, expect, it } from "vitest"

import {
  MODEL_ANSWER_SUFFIX,
  withFileNameSuffix,
} from "@/components/answer-sheet-builder/exportFileNames"

describe("模範解答のファイル名", () => {
  it("拡張子の手前に入る", () => {
    expect(withFileNameSuffix("解答用紙.pdf", MODEL_ANSWER_SUFFIX)).toBe(
      "解答用紙_模範解答.pdf"
    )
    expect(
      withFileNameSuffix("/home/keppy/書類/解答用紙.png", MODEL_ANSWER_SUFFIX)
    ).toBe("/home/keppy/書類/解答用紙_模範解答.png")
  })

  it("途中のディレクトリ名にある点を拡張子と間違えない", () => {
    expect(
      withFileNameSuffix("/home/keppy/2026.前期/解答用紙", MODEL_ANSWER_SUFFIX)
    ).toBe("/home/keppy/2026.前期/解答用紙_模範解答")
    expect(
      withFileNameSuffix(
        "C:\\Users\\keppy\\2026.前期\\解答用紙",
        MODEL_ANSWER_SUFFIX
      )
    ).toBe("C:\\Users\\keppy\\2026.前期\\解答用紙_模範解答")
  })

  it("名前自体に点があっても、最後の拡張子だけを見る", () => {
    expect(withFileNameSuffix("解答用紙.v2.pdf", MODEL_ANSWER_SUFFIX)).toBe(
      "解答用紙.v2_模範解答.pdf"
    )
  })
})
