/**
 * 06-student-answers テーブル DnD（方式B）の純粋ロジック検証。
 *
 * セル座標 droppable の codec と、view モードの move/swap（applyCellMoveOrSwap）を
 * ブラウザ非依存で検証する。座標は id（examPageId）で持つ。実際のドラッグ操作
 * （dnd-kit の衝突判定・描画）はここでは扱わず、`npm run dev` での手動確認に委ねる。
 */

import { describe, expect, it } from "vitest"

import {
  applyCellMoveOrSwap,
  decodeCellDroppableId,
  diffFilesAgainstBaseline,
  encodeCellDroppableId,
} from "@/components/exams/06-student-answers/student-answer-table/utils/dragDropUtils"
import { partitionAnswerItemsByPlacement } from "@/components/exams/06-student-answers/student-answer-table/utils/tableDataUtils"
import type { AnswerImageIdentity } from "@/components/exams/06-student-answers/types"

function makeFile(
  id: string,
  studentId: string | null,
  examPageId: string | null
): AnswerImageIdentity {
  return { id, studentId, examPageId }
}

const STUDENT_A = "11111111-1111-4111-8111-111111111111"
const STUDENT_B = "22222222-2222-4222-8222-222222222222"
const PAGE_1 = "aaaaaaaa-0001-4001-8001-000000000001"
const PAGE_2 = "aaaaaaaa-0002-4002-8002-000000000002"
const PAGE_3 = "aaaaaaaa-0003-4003-8003-000000000003"

describe("encodeCellDroppableId / decodeCellDroppableId", () => {
  it("エンコードとデコードが往復で一致する", () => {
    const encoded = encodeCellDroppableId(STUDENT_A, PAGE_1)
    expect(encoded).toBe(`cell:${STUDENT_A}:${PAGE_1}`)
    expect(decodeCellDroppableId(encoded)).toEqual({
      studentId: STUDENT_A,
      examPageId: PAGE_1,
    })
  })

  it("cell: 接頭辞でない ID（ファイルID）は null を返す", () => {
    expect(decodeCellDroppableId(STUDENT_A)).toBeNull()
    expect(decodeCellDroppableId("trash-area")).toBeNull()
  })

  it("examPageId が空なら null を返す", () => {
    expect(decodeCellDroppableId(`cell:${STUDENT_A}:`)).toBeNull()
  })
})

describe("applyCellMoveOrSwap", () => {
  it("空セルへの移動: ドラッグした答案の座標だけが更新される", () => {
    const files = [makeFile("f1", STUDENT_A, PAGE_1)]
    const result = applyCellMoveOrSwap(files, "f1", {
      studentId: STUDENT_B,
      examPageId: PAGE_2,
    })

    expect(result).not.toBe(files)
    expect(result.find((file) => file.id === "f1")).toMatchObject({
      studentId: STUDENT_B,
      examPageId: PAGE_2,
    })
  })

  it("占有セルへの移動: 2つの答案の座標が入れ替わる（同一ページの生徒付け替え）", () => {
    const files = [
      makeFile("f1", STUDENT_A, PAGE_1),
      makeFile("f2", STUDENT_B, PAGE_1),
    ]
    // f1 を studentB, page1（f2 の居場所）へ → swap
    const result = applyCellMoveOrSwap(files, "f1", {
      studentId: STUDENT_B,
      examPageId: PAGE_1,
    })

    expect(result.find((file) => file.id === "f1")).toMatchObject({
      studentId: STUDENT_B,
      examPageId: PAGE_1,
    })
    expect(result.find((file) => file.id === "f2")).toMatchObject({
      studentId: STUDENT_A,
      examPageId: PAGE_1,
    })
  })

  it("対角の入れ替え: (A,p1) と (B,p2) がページを跨いで座標入れ替えになる", () => {
    const files = [
      makeFile("f1", STUDENT_A, PAGE_1),
      makeFile("f2", STUDENT_B, PAGE_2),
    ]
    const result = applyCellMoveOrSwap(files, "f1", {
      studentId: STUDENT_B,
      examPageId: PAGE_2,
    })

    expect(result.find((file) => file.id === "f1")).toMatchObject({
      studentId: STUDENT_B,
      examPageId: PAGE_2,
    })
    expect(result.find((file) => file.id === "f2")).toMatchObject({
      studentId: STUDENT_A,
      examPageId: PAGE_1,
    })
  })

  it("同一セルへのドロップは変更なし（同じ配列参照を返す）", () => {
    const files = [makeFile("f1", STUDENT_A, PAGE_1)]
    const result = applyCellMoveOrSwap(files, "f1", {
      studentId: STUDENT_A,
      examPageId: PAGE_1,
    })
    expect(result).toBe(files)
  })

  it("存在しない activeFileId は変更なし", () => {
    const files = [makeFile("f1", STUDENT_A, PAGE_1)]
    const result = applyCellMoveOrSwap(files, "missing", {
      studentId: STUDENT_B,
      examPageId: PAGE_2,
    })
    expect(result).toBe(files)
  })

  it("移動元が配置不能（孤立答案）なら占有セルへの swap を拒否する（有効答案の巻き込み防止）", () => {
    const withdrawn = "99999999-9999-4999-8999-999999999999"
    const files = [
      makeFile("orphan", withdrawn, PAGE_1),
      makeFile("valid", STUDENT_A, PAGE_1),
    ]
    // 孤立答案 orphan を valid の居場所（占有セル）へ → source 配置不能なので拒否
    const result = applyCellMoveOrSwap(
      files,
      "orphan",
      { studentId: STUDENT_A, examPageId: PAGE_1 },
      new Set(["orphan", "valid"]),
      false // isSourcePlaceable
    )
    expect(result).toBe(files) // 変更なし（valid を除籍座標へ押し出さない）
  })

  it("移動元が配置不能でも空セルへの移動は許す（孤立答案の救済）", () => {
    const withdrawn = "99999999-9999-4999-8999-999999999999"
    const files = [makeFile("orphan", withdrawn, PAGE_1)]
    const result = applyCellMoveOrSwap(
      files,
      "orphan",
      { studentId: STUDENT_A, examPageId: PAGE_2 },
      new Set(["orphan"]),
      false
    )
    expect(result).not.toBe(files)
    expect(result.find((file) => file.id === "orphan")).toMatchObject({
      studentId: STUDENT_A,
      examPageId: PAGE_2,
    })
  })

  it("occupantEligibleIds に含まれない占有ファイルは swap 対象にしない（隠れ答案の巻き込み防止）", () => {
    // f2 は移動先座標に居るが「表に見えていない」→ swap せず、移動先に移すだけ
    const files = [
      makeFile("f1", STUDENT_A, PAGE_1),
      makeFile("f2", STUDENT_B, PAGE_1),
    ]
    const result = applyCellMoveOrSwap(
      files,
      "f1",
      { studentId: STUDENT_B, examPageId: PAGE_1 },
      new Set(["f1"]) // f2 は対象外
    )
    expect(result.find((file) => file.id === "f1")).toMatchObject({
      studentId: STUDENT_B,
      examPageId: PAGE_1,
    })
    // f2 は動かない（隠れて座標を書き換えられない）
    expect(result.find((file) => file.id === "f2")).toMatchObject({
      studentId: STUDENT_B,
      examPageId: PAGE_1,
    })
  })
})

describe("diffFilesAgainstBaseline", () => {
  const baseline = [
    { id: "f1", studentId: STUDENT_A, examPageId: PAGE_1 },
    { id: "f2", studentId: STUDENT_B, examPageId: PAGE_1 },
  ]

  it("DB 基準から座標が変わったファイルだけを from(DB)/to(現在) で返す", () => {
    // f1 を studentB, page2 へ移動済みの working copy
    const files = [
      makeFile("f1", STUDENT_B, PAGE_2),
      makeFile("f2", STUDENT_B, PAGE_1),
    ]
    const diff = diffFilesAgainstBaseline(files, baseline)

    expect(diff).toHaveLength(1)
    expect(diff[0]).toMatchObject({
      fileId: "f1",
      fromState: { studentId: STUDENT_A, examPageId: PAGE_1 },
      toState: { studentId: STUDENT_B, examPageId: PAGE_2 },
    })
  })

  it("複数回ドラッグ相当（2件移動済み）でも累積差分を全件返す（[3] の回帰防止）", () => {
    // f1→(B,p2), f2→(A,p2) の 2 件を移動した状態
    const files = [
      makeFile("f1", STUDENT_B, PAGE_2),
      makeFile("f2", STUDENT_A, PAGE_2),
    ]
    const diff = diffFilesAgainstBaseline(files, baseline)

    expect(diff.map((change) => change.fileId).sort()).toEqual(["f1", "f2"])
  })

  it("DB と同じ配置に戻れば差分は空（stateless なので元に戻すと消える）", () => {
    const files = [
      makeFile("f1", STUDENT_A, PAGE_1),
      makeFile("f2", STUDENT_B, PAGE_1),
    ]
    expect(diffFilesAgainstBaseline(files, baseline)).toHaveLength(0)
  })

  it("baseline に無い id（新規・除籍等）は差分対象外", () => {
    const files = [makeFile("unknown", STUDENT_A, PAGE_3)]
    expect(diffFilesAgainstBaseline(files, baseline)).toHaveLength(0)
  })
})

describe("partitionAnswerItemsByPlacement（孤立答案 [4]/[5]）", () => {
  const roster = [STUDENT_A, STUDENT_B]
  const examPageIds = [PAGE_1, PAGE_2]

  it("ロスター内かつ列にある examPageId の答案はマスに配置される", () => {
    const items = [
      makeFile("f1", STUDENT_A, PAGE_1),
      makeFile("f2", STUDENT_B, PAGE_2),
    ]
    const { placedByCell, orphans } = partitionAnswerItemsByPlacement(
      items,
      roster,
      examPageIds
    )
    expect(orphans).toHaveLength(0)
    // studentIndex-pageIndex（0始まり）
    expect(placedByCell.get("0-0")?.id).toBe("f1")
    expect(placedByCell.get("1-1")?.id).toBe("f2")
  })

  it("[4] studentId が現ロスターに無い答案（除籍）は孤立答案になる", () => {
    const withdrawn = "99999999-9999-4999-8999-999999999999"
    const items = [makeFile("f1", withdrawn, PAGE_1)]
    const { placedByCell, orphans } = partitionAnswerItemsByPlacement(
      items,
      roster,
      examPageIds
    )
    expect(placedByCell.size).toBe(0)
    expect(orphans.map((item) => item.id)).toEqual(["f1"])
  })

  it("[5] examPageId が列に無い（ページ削除）答案は孤立答案になる", () => {
    const items = [makeFile("f1", STUDENT_A, PAGE_3)] // 列に無い examPageId
    const { placedByCell, orphans } = partitionAnswerItemsByPlacement(
      items,
      roster,
      examPageIds
    )
    expect(placedByCell.size).toBe(0)
    expect(orphans.map((item) => item.id)).toEqual(["f1"])
  })

  it("studentId 未設定の答案も孤立答案になる", () => {
    const items = [makeFile("f1", null, PAGE_1)]
    const { orphans } = partitionAnswerItemsByPlacement(
      items,
      roster,
      examPageIds
    )
    expect(orphans.map((item) => item.id)).toEqual(["f1"])
  })
})
