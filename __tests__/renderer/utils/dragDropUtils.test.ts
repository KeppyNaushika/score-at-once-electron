/**
 * 06-student-answers テーブル DnD（方式B）の純粋ロジック検証。
 *
 * セル座標 droppable の codec と、view モードの move/swap（applyCellMoveOrSwap）を
 * ブラウザ非依存で検証する。実際のドラッグ操作（dnd-kit の衝突判定・描画）は
 * ここでは扱わず、`npm run dev` での手動確認に委ねる。
 */

import { describe, expect, it } from "vitest"

import {
  applyCellMoveOrSwap,
  decodeCellDroppableId,
  diffFilesAgainstBaseline,
  encodeCellDroppableId,
} from "@/components/exams/06-student-answers/student-answer-table/utils/dragDropUtils"
import type { UnifiedFile } from "@/components/exams/06-student-answers/types"

function makeFile(
  id: string,
  studentId: string | undefined,
  pageNumber: number
): UnifiedFile {
  return {
    id,
    name: `answer-${id}`,
    type: "image/png",
    pageNumber,
    isSelected: false,
    originalFileName: `answer-${id}.png`,
    studentId,
  }
}

const STUDENT_A = "11111111-1111-4111-8111-111111111111"
const STUDENT_B = "22222222-2222-4222-8222-222222222222"

describe("encodeCellDroppableId / decodeCellDroppableId", () => {
  it("エンコードとデコードが往復で一致する", () => {
    const encoded = encodeCellDroppableId(STUDENT_A, 3)
    expect(encoded).toBe(`cell:${STUDENT_A}:3`)
    expect(decodeCellDroppableId(encoded)).toEqual({
      studentId: STUDENT_A,
      pageNumber: 3,
    })
  })

  it("cell: 接頭辞でない ID（ファイルID）は null を返す", () => {
    expect(decodeCellDroppableId(STUDENT_A)).toBeNull()
    expect(decodeCellDroppableId("trash-area")).toBeNull()
  })

  it("ページ番号が整数でなければ null を返す", () => {
    expect(decodeCellDroppableId(`cell:${STUDENT_A}:abc`)).toBeNull()
    expect(decodeCellDroppableId(`cell:${STUDENT_A}:`)).toBeNull()
  })
})

describe("applyCellMoveOrSwap", () => {
  it("空セルへの移動: ドラッグした答案の座標だけが更新される", () => {
    const files = [makeFile("f1", STUDENT_A, 1)]
    const result = applyCellMoveOrSwap(files, "f1", {
      studentId: STUDENT_B,
      pageNumber: 2,
    })

    expect(result).not.toBe(files)
    expect(result.find((file) => file.id === "f1")).toMatchObject({
      studentId: STUDENT_B,
      pageNumber: 2,
    })
  })

  it("占有セルへの移動: 2つの答案の座標が入れ替わる（同一ページの生徒付け替え）", () => {
    const files = [makeFile("f1", STUDENT_A, 1), makeFile("f2", STUDENT_B, 1)]
    // f1 を studentB, page1（f2 の居場所）へ → swap
    const result = applyCellMoveOrSwap(files, "f1", {
      studentId: STUDENT_B,
      pageNumber: 1,
    })

    expect(result.find((file) => file.id === "f1")).toMatchObject({
      studentId: STUDENT_B,
      pageNumber: 1,
    })
    expect(result.find((file) => file.id === "f2")).toMatchObject({
      studentId: STUDENT_A,
      pageNumber: 1,
    })
  })

  it("対角の入れ替え: (A,p1) と (B,p2) がページを跨いで座標入れ替えになる", () => {
    const files = [makeFile("f1", STUDENT_A, 1), makeFile("f2", STUDENT_B, 2)]
    const result = applyCellMoveOrSwap(files, "f1", {
      studentId: STUDENT_B,
      pageNumber: 2,
    })

    expect(result.find((file) => file.id === "f1")).toMatchObject({
      studentId: STUDENT_B,
      pageNumber: 2,
    })
    expect(result.find((file) => file.id === "f2")).toMatchObject({
      studentId: STUDENT_A,
      pageNumber: 1,
    })
  })

  it("同一セルへのドロップは変更なし（同じ配列参照を返す）", () => {
    const files = [makeFile("f1", STUDENT_A, 1)]
    const result = applyCellMoveOrSwap(files, "f1", {
      studentId: STUDENT_A,
      pageNumber: 1,
    })
    expect(result).toBe(files)
  })

  it("存在しない activeFileId は変更なし", () => {
    const files = [makeFile("f1", STUDENT_A, 1)]
    const result = applyCellMoveOrSwap(files, "missing", {
      studentId: STUDENT_B,
      pageNumber: 2,
    })
    expect(result).toBe(files)
  })

  it("occupantEligibleIds に含まれない占有ファイルは swap 対象にしない（隠れ答案の巻き込み防止）", () => {
    // f2 は移動先座標に居るが「表に見えていない」→ swap せず、移動先に移すだけ
    const files = [makeFile("f1", STUDENT_A, 1), makeFile("f2", STUDENT_B, 1)]
    const result = applyCellMoveOrSwap(
      files,
      "f1",
      { studentId: STUDENT_B, pageNumber: 1 },
      new Set(["f1"]) // f2 は対象外
    )
    expect(result.find((file) => file.id === "f1")).toMatchObject({
      studentId: STUDENT_B,
      pageNumber: 1,
    })
    // f2 は動かない（隠れて座標を書き換えられない）
    expect(result.find((file) => file.id === "f2")).toMatchObject({
      studentId: STUDENT_B,
      pageNumber: 1,
    })
  })
})

describe("diffFilesAgainstBaseline", () => {
  const baseline = [
    { id: "f1", studentId: STUDENT_A, pageNumber: 1 },
    { id: "f2", studentId: STUDENT_B, pageNumber: 1 },
  ]

  it("DB 基準から座標が変わったファイルだけを from(DB)/to(現在) で返す", () => {
    // f1 を studentB へ移動済みの working copy
    const files = [makeFile("f1", STUDENT_B, 2), makeFile("f2", STUDENT_B, 1)]
    const diff = diffFilesAgainstBaseline(files, baseline)

    expect(diff).toHaveLength(1)
    expect(diff[0]).toMatchObject({
      fileId: "f1",
      fromState: { studentId: STUDENT_A, pageNumber: 1 },
      toState: { studentId: STUDENT_B, pageNumber: 2 },
    })
  })

  it("複数回ドラッグ相当（2件移動済み）でも累積差分を全件返す（[3] の回帰防止）", () => {
    // f1→(B,2), f2→(A,2) の 2 件を移動した状態
    const files = [makeFile("f1", STUDENT_B, 2), makeFile("f2", STUDENT_A, 2)]
    const diff = diffFilesAgainstBaseline(files, baseline)

    expect(diff.map((change) => change.fileId).sort()).toEqual(["f1", "f2"])
  })

  it("DB と同じ配置に戻れば差分は空（stateless なので元に戻すと消える）", () => {
    const files = [makeFile("f1", STUDENT_A, 1), makeFile("f2", STUDENT_B, 1)]
    expect(diffFilesAgainstBaseline(files, baseline)).toHaveLength(0)
  })

  it("baseline に無い id（新規・除籍等）は差分対象外", () => {
    const files = [makeFile("unknown", STUDENT_A, 3)]
    expect(diffFilesAgainstBaseline(files, baseline)).toHaveLength(0)
  })
})
