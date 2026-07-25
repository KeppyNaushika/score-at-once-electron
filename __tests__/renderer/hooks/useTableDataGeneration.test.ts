// @vitest-environment jsdom
/**
 * 06-student-answers 答案テーブルの行生成（useTableDataGeneration）の検証。
 *
 * 守りたい不変条件は「行の生徒とマスのページが、そのマスに置かれた答案の
 * 書き込み先（studentId / examPageId）と必ず一致すること」。
 * ここがずれると別の生徒の答案として保存されるため、表示ではなく保存の正しさに直結する。
 * 行は ExamStudent 実体、マスは ExamPage 実体を同梱して返るので、添字の一致に依存しない。
 */

import { renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { useTableDataGeneration } from "@/components/exams/06-student-answers/student-answer-table/hooks/useTableDataGeneration"
import type { ExtendedDisabledState } from "@/components/exams/06-student-answers/student-answer-table/types"
import type { CellLookup } from "@/components/exams/06-student-answers/student-answer-table/utils/tableDataUtils"
import { addCellToLookup } from "@/components/exams/06-student-answers/student-answer-table/utils/tableDataUtils"
import type {
  ExamPageColumn,
  UnsavedAnswerImage,
} from "@/components/exams/06-student-answers/types"
import type { ExamStudentWithMemberships } from "@/types/prismaExtensions"

const EXAM_ID = "eeeeeeee-0000-4000-8000-000000000000"
const EPOCH = new Date("2026-01-01T00:00:00.000Z")

const STUDENT_A = "11111111-1111-4111-8111-111111111111"
const STUDENT_B = "22222222-2222-4222-8222-222222222222"
const PAGE_1 = "aaaaaaaa-0001-4001-8001-000000000001"
const PAGE_2 = "aaaaaaaa-0002-4002-8002-000000000002"

function makeExamStudent(
  examStudentId: string,
  studentId: string,
  studentNumber: string,
  customOrder: number
): ExamStudentWithMemberships {
  return {
    id: examStudentId,
    examId: EXAM_ID,
    studentId,
    status: "participating",
    customOrder,
    createdAt: EPOCH,
    updatedAt: EPOCH,
    student: {
      id: studentId,
      studentNumber,
      lastName: "山田",
      firstName: studentNumber,
      lastNameKana: "ヤマダ",
      firstNameKana: "タロウ",
      enrollmentYear: 2026,
      createdAt: EPOCH,
      updatedAt: EPOCH,
      memberships: [],
      _count: { studentAnswerImages: 0 },
    },
  }
}

function makeUnsavedAnswer(id: string): UnsavedAnswerImage {
  return {
    id,
    studentId: null,
    examPageId: null,
    imagePath: null,
    buffer: new ArrayBuffer(1),
    name: id,
    originalFileName: `${id}.png`,
    fileType: "image/png",
    isSelected: false,
  }
}

function makePlacedAnswer(
  id: string,
  studentId: string | null,
  examPageId: string | null
): UnsavedAnswerImage {
  return { ...makeUnsavedAnswer(id), studentId, examPageId }
}

/** 指定マスだけ「既存答案あり」とするルックアップ */
function existingAnswerAt(studentId: string, examPageId: string): CellLookup {
  const lookup: CellLookup = new Map()
  addCellToLookup(lookup, studentId, examPageId)
  return lookup
}

const EMPTY_DISABLED_STATE: ExtendedDisabledState = {
  rows: [],
  cols: [],
  cells: [],
  files: new Set(),
}

const NO_EXISTING_ANSWERS: CellLookup = new Map()

const EXAM_PAGES: ExamPageColumn[] = [
  { id: PAGE_1, pageNumber: 1 },
  { id: PAGE_2, pageNumber: 2 },
]

/** 行・マスを「行の生徒番号 / マスのページ番号 → 置かれた答案id」へ畳んだ検査用の表現 */
function summarize(
  tableRows: ReturnType<
    typeof useTableDataGeneration<UnsavedAnswerImage>
  >["tableRows"]
) {
  return tableRows.map((row) => ({
    studentId: row.examStudent.studentId,
    cells: row.cells.map((cell) => ({
      examPageId: cell.examPage.id,
      type: cell.type,
      fileId: cell.file?.id ?? null,
    })),
  }))
}

describe("useTableDataGeneration", () => {
  // 生徒の並びは customOrder 順（B が先）。行の実体がその並びに追随することを見る。
  const sortedStudents = [
    makeExamStudent("es-b", STUDENT_B, "002", 1),
    makeExamStudent("es-a", STUDENT_A, "001", 2),
  ]

  it("upload: 自動配置された答案は、その行の生徒とマスのページに対応する", () => {
    const files = [makeUnsavedAnswer("f1"), makeUnsavedAnswer("f2")]

    const { result } = renderHook(() =>
      useTableDataGeneration<UnsavedAnswerImage>({
        files,
        sortedStudents,
        examPages: EXAM_PAGES,
        fileOrder: "student-first",
        disabledState: EMPTY_DISABLED_STATE,
        mode: "upload",
        enhancedIsCellDisabled: () => false,
        cellsWithExistingAnswers: NO_EXISTING_ANSWERS,
      })
    )

    // student-first なので先頭生徒（customOrder 1 の B）の p1・p2 から順に埋まる
    expect(summarize(result.current.tableRows)).toEqual([
      {
        studentId: STUDENT_B,
        cells: [
          { examPageId: PAGE_1, type: "file", fileId: "f1" },
          { examPageId: PAGE_2, type: "file", fileId: "f2" },
        ],
      },
      {
        studentId: STUDENT_A,
        cells: [
          { examPageId: PAGE_1, type: "empty", fileId: null },
          { examPageId: PAGE_2, type: "empty", fileId: null },
        ],
      },
    ])
  })

  it("upload: page-first では同一ページを生徒順に埋める", () => {
    const files = [makeUnsavedAnswer("f1"), makeUnsavedAnswer("f2")]

    const { result } = renderHook(() =>
      useTableDataGeneration<UnsavedAnswerImage>({
        files,
        sortedStudents,
        examPages: EXAM_PAGES,
        fileOrder: "page-first",
        disabledState: EMPTY_DISABLED_STATE,
        mode: "upload",
        enhancedIsCellDisabled: () => false,
        cellsWithExistingAnswers: NO_EXISTING_ANSWERS,
      })
    )

    const rows = summarize(result.current.tableRows)
    expect(rows[0].studentId).toBe(STUDENT_B)
    expect(rows[0].cells[0]).toEqual({
      examPageId: PAGE_1,
      type: "file",
      fileId: "f1",
    })
    expect(rows[1].studentId).toBe(STUDENT_A)
    expect(rows[1].cells[0]).toEqual({
      examPageId: PAGE_1,
      type: "file",
      fileId: "f2",
    })
  })

  it("view: 答案は自身の (studentId, examPageId) のマスに載る", () => {
    const files = [
      makePlacedAnswer("f1", STUDENT_A, PAGE_2),
      makePlacedAnswer("f2", STUDENT_B, PAGE_1),
    ]

    const { result } = renderHook(() =>
      useTableDataGeneration<UnsavedAnswerImage>({
        files,
        sortedStudents,
        examPages: EXAM_PAGES,
        fileOrder: "page-first",
        disabledState: EMPTY_DISABLED_STATE,
        mode: "view",
        enhancedIsCellDisabled: () => true,
        cellsWithExistingAnswers: NO_EXISTING_ANSWERS,
      })
    )

    expect(result.current.orphanItems).toHaveLength(0)
    expect(summarize(result.current.tableRows)).toEqual([
      {
        studentId: STUDENT_B,
        cells: [
          { examPageId: PAGE_1, type: "file", fileId: "f2" },
          { examPageId: PAGE_2, type: "disabled", fileId: null },
        ],
      },
      {
        studentId: STUDENT_A,
        cells: [
          { examPageId: PAGE_1, type: "disabled", fileId: null },
          { examPageId: PAGE_2, type: "file", fileId: "f1" },
        ],
      },
    ])
  })

  it("view: 名簿にない生徒・列にないページの答案は孤立答案になる", () => {
    const withdrawn = "99999999-9999-4999-8999-999999999999"
    const removedPage = "aaaaaaaa-0009-4009-8009-000000000009"
    const files = [
      makePlacedAnswer("f1", withdrawn, PAGE_1),
      makePlacedAnswer("f2", STUDENT_A, removedPage),
    ]

    const { result } = renderHook(() =>
      useTableDataGeneration<UnsavedAnswerImage>({
        files,
        sortedStudents,
        examPages: EXAM_PAGES,
        fileOrder: "page-first",
        disabledState: EMPTY_DISABLED_STATE,
        mode: "view",
        enhancedIsCellDisabled: () => true,
        cellsWithExistingAnswers: NO_EXISTING_ANSWERS,
      })
    )

    expect(result.current.orphanItems.map((orphan) => orphan.id)).toEqual([
      "f1",
      "f2",
    ])
    for (const row of result.current.tableRows) {
      for (const cell of row.cells) {
        expect(cell.file).toBeUndefined()
      }
    }
  })

  it("upload: 上書き無効なら既存答案のマスは埋めずに飛ばす", () => {
    const files = [makeUnsavedAnswer("f1")]

    const { result } = renderHook(() =>
      useTableDataGeneration<UnsavedAnswerImage>({
        files,
        sortedStudents,
        examPages: EXAM_PAGES,
        fileOrder: "student-first",
        disabledState: EMPTY_DISABLED_STATE,
        mode: "upload",
        enhancedIsCellDisabled: () => false,
        allowOverwrite: false,
        // 先頭マス（生徒B・p1）は既に DB 答案が居る
        cellsWithExistingAnswers: existingAnswerAt(STUDENT_B, PAGE_1),
      })
    )

    const rows = summarize(result.current.tableRows)
    expect(rows[0].cells[0]).toEqual({
      examPageId: PAGE_1,
      type: "disabled",
      fileId: null,
    })
    // 新規ファイルは占有マスを飛ばして次の空きマス（生徒B・p2）へ入る
    expect(rows[0].cells[1]).toEqual({
      examPageId: PAGE_2,
      type: "file",
      fileId: "f1",
    })
  })
})
