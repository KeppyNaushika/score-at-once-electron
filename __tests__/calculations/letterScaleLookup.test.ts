/**
 * 同じ評語（A・B・C…）の行が2つあるときに、**どの端末でも同じ点で換算する**こと。
 *
 * `CourseworkLetterScale` の `(courseworkItemId, label)` の `@@unique` は
 * 2026-08-23 に外した。評語は1行ずつ人が打ち、「行を追加」は未使用の評語の先頭を
 * 取るので、刻みの無い評価項目で2人が同時に押すと2人とも `A` を作る。A=100 と
 * A=90 という**別の刻み**なので、unique を張ったまま同期に畳ませると負けた側の
 * ラベルを持つ点数が換算先を失う。だから外したのは正しい。
 *
 * ただし外した以上、引く側が「どちらを採るか」を決めなければならない。
 * `find`（先頭勝ち）のままだと、並びは `order` で決まり、同時に作られた2行は
 * `order` まで同値なので SQLite の行番号順＝**端末ごとに違う順**になる。
 * 同じデータから端末ごとに違う成績が出て、画面には何も出ない。
 */

import { describe, expect, it } from "vitest"

import {
  duplicateLetterLabels,
  findLetterScale,
} from "@/lib/shared/letterScaleLookup"

/** 変換表の1行。id は uuid（どの端末でも同じ値） */
const scale = (id: string, label: string, score: number) => ({
  id,
  label,
  score,
})

describe("findLetterScale", () => {
  it("重複が無ければ、その行を返す", () => {
    const letterScales = [scale("uuid-1", "A", 100), scale("uuid-2", "B", 80)]

    expect(findLetterScale(letterScales, "B")?.score).toBe(80)
  })

  it("変換表に無い評語なら undefined", () => {
    expect(findLetterScale([scale("uuid-1", "A", 100)], "Z")).toBeUndefined()
  })

  it("同じ評語が2つあれば、id のいちばん小さい方を採る", () => {
    const letterScales = [scale("uuid-b", "A", 90), scale("uuid-a", "A", 100)]

    expect(findLetterScale(letterScales, "A")?.id).toBe("uuid-a")
  })

  it("並び順が逆でも同じ行を採る（端末ごとに変わらない）", () => {
    const forward = [scale("uuid-a", "A", 100), scale("uuid-b", "A", 90)]
    const backward = [scale("uuid-b", "A", 90), scale("uuid-a", "A", 100)]

    // ここが本体。行番号順は端末ごとに違うので、順に依存すると
    // 同じデータから端末ごとに違う点が出る
    expect(findLetterScale(forward, "A")?.score).toBe(
      findLetterScale(backward, "A")?.score
    )
  })

  it("3つ以上あっても、いちばん小さい id に決まる", () => {
    const letterScales = [
      scale("uuid-c", "A", 70),
      scale("uuid-a", "A", 100),
      scale("uuid-b", "A", 90),
    ]

    expect(findLetterScale(letterScales, "A")?.id).toBe("uuid-a")
  })

  it("評語はそのまま比べる（大小文字・全角を寄せない）", () => {
    const letterScales = [scale("uuid-1", "A", 100), scale("uuid-2", "a", 50)]

    expect(findLetterScale(letterScales, "a")?.score).toBe(50)
    expect(findLetterScale(letterScales, "Ａ")).toBeUndefined()
  })
})

describe("duplicateLetterLabels", () => {
  it("重複が無ければ空", () => {
    expect(
      duplicateLetterLabels([
        scale("uuid-1", "A", 100),
        scale("uuid-2", "B", 80),
      ])
    ).toEqual([])
  })

  it("2行以上ある評語を挙げる", () => {
    expect(
      duplicateLetterLabels([
        scale("uuid-1", "A", 100),
        scale("uuid-2", "B", 80),
        scale("uuid-3", "A", 90),
      ])
    ).toEqual(["A"])
  })

  it("重複が複数種あれば全部挙げる", () => {
    expect(
      duplicateLetterLabels([
        scale("uuid-1", "A", 100),
        scale("uuid-2", "B", 80),
        scale("uuid-3", "A", 90),
        scale("uuid-4", "B", 70),
      ])
    ).toEqual(["A", "B"])
  })
})
