import { describe, expect, it } from "vitest"

import {
  buildDeletionBlockedMessage,
  buildItemDeletionWarning,
  listReferencingGradeNames,
} from "@/lib/shared/gradeReferenceMessages"
import type { GradeReference } from "@/types/gradeReference.types"

const reference = (overrides: Partial<GradeReference>): GradeReference => ({
  gradeId: "grade-1",
  gradeName: "1学期成績",
  gradeItemName: "知識・技能",
  dataSourceId: crypto.randomUUID(),
  dataSourceName: "問1",
  dataSourceType: "crop_region",
  usage: "direct",
  ...overrides,
})

describe("listReferencingGradeNames", () => {
  it("成績算出の名前を出てきた順に重複なく返す", () => {
    expect(
      listReferencingGradeNames([
        reference({ gradeName: "A" }),
        reference({ gradeName: "B" }),
        reference({ gradeName: "A" }),
      ])
    ).toEqual(["A", "B"])
  })
})

describe("buildDeletionBlockedMessage", () => {
  it("使われていなければ null", () => {
    expect(buildDeletionBlockedMessage("exam", [])).toBeNull()
  })

  it("使っているデータソースを1行ずつ並べる", () => {
    const message = buildDeletionBlockedMessage("exam", [
      reference({ dataSourceType: "exam_total", dataSourceName: "中間" }),
      reference({ gradeName: "2学期成績", dataSourceName: "問1" }),
    ])
    expect(message).toContain(
      "この試験は次の成績算出で使われているため、削除できません。"
    )
    expect(message).toContain(
      "・成績算出「1学期成績」の評価項目「知識・技能」のデータソース「中間」"
    )
    expect(message).toContain(
      "・成績算出「2学期成績」の評価項目「知識・技能」のデータソース「問1」"
    )
  })

  it("資料の文言", () => {
    expect(
      buildDeletionBlockedMessage("coursework", [reference({})])
    ).toContain("この試験外成績資料は次の成績算出で使われているため")
  })
})

describe("buildItemDeletionWarning", () => {
  it("使われていなければ null", () => {
    expect(buildItemDeletionWarning("cropRegion", [])).toBeNull()
  })

  it("設問: そのものを使うデータソースは削除、合計に含むものは点数が変わる", () => {
    const message = buildItemDeletionWarning("cropRegion", [
      reference({ dataSourceName: "問1" }),
      reference({
        dataSourceName: "中間テスト",
        dataSourceType: "exam_total",
        usage: "total",
      }),
      reference({
        dataSourceName: "計算",
        dataSourceType: "subtotal",
        usage: "total",
      }),
    ])
    expect(message).toContain("データソース「問1」（この設問）が削除されます")
    expect(message).toContain(
      "データソース「中間テスト」（試験の合計点）の点数が変わります"
    )
    expect(message).toContain("データソース「計算」（小計）の点数が変わります")
  })

  it("評価項目: そのものを使うデータソースは参照先を失い、資料合計は変わる", () => {
    const message = buildItemDeletionWarning("courseworkItem", [
      reference({ dataSourceName: "提出物", dataSourceType: "coursework" }),
      reference({
        dataSourceName: "課題合計",
        dataSourceType: "coursework_total",
        usage: "total",
      }),
    ])
    expect(message).toContain(
      "データソース「提出物」（この評価項目）が参照先を失い、点数を取り込めなくなります"
    )
    expect(message).toContain(
      "データソース「課題合計」（資料合計）の点数が変わります"
    )
  })

  it("小計項目: データソースが削除される", () => {
    expect(
      buildItemDeletionWarning("subtotal", [
        reference({ dataSourceName: "計算", dataSourceType: "subtotal" }),
      ])
    ).toContain("データソース「計算」（この小計項目）が削除されます")
  })
})
