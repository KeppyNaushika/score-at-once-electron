/**
 * 統合アーカイブ（.sao）での AI 採点の記録（選べる項目 `aiGradingRecords`）の範囲と振り直し
 *
 * - 選ばなければ入らない（関連データではなく実験の記録。docs/vlm-grading-design.md §4-2）
 * - 選べば、書き出す試験の設問のプロンプト・実行・判定が入る
 * - 採点と答案を外せば判定が外れる（判定は受験生を必須で参照する）
 * - 本人分だけにすれば、他の教員の実行とその判定が外れる（プロンプトは共有なので残る）
 * - 「別で追加」で試験を振り直せば、AI 採点の記録も振り直る
 *
 * DB を使わず、範囲の判定に要る列だけを持った合成の行で確かめる。
 */

import { describe, expect, it } from "vitest"

import {
  type ArchiveSelection,
  resolveArchiveScope,
} from "../../../electron-src/lib/export/unified-archive/archiveScopeResolver"
import { ARCHIVE_TABLES } from "../../../electron-src/lib/export/unified-archive/archiveTableRegistry"
import { renumberSeparateRows } from "../../../electron-src/lib/import/unified-archive/archiveRowReader"

/** 表名 → id → 外部キーの値（書いていない外部キーは null） */
const SYNTHETIC_ROWS: Readonly<
  Record<string, Readonly<Record<string, Readonly<Record<string, string>>>>>
> = {
  User: { teacher: {}, colleague: {} },
  Student: { student: {} },
  Exam: { exam: {} },
  ExamPage: { page: { examId: "exam" } },
  CropRegion: { region: { examPageId: "page" } },
  ExamStudent: { examStudent: { examId: "exam", studentId: "student" } },
  QuestionScore: {
    score: {
      examStudentId: "examStudent",
      cropRegionId: "region",
      userId: "teacher",
    },
  },
  // 同僚が最初に書き、教員が直したプロンプト
  AiPrompt: {
    firstPrompt: { cropRegionId: "region", createdByUserId: "colleague" },
    revisedPrompt: {
      cropRegionId: "region",
      parentPromptId: "firstPrompt",
      createdByUserId: "teacher",
    },
  },
  AiGradingRun: {
    teacherRun: { userId: "teacher", promptId: "revisedPrompt" },
    colleagueRun: { userId: "colleague", promptId: "firstPrompt" },
  },
  AiGradingAttempt: {
    teacherAttempt: {
      runId: "teacherRun",
      examStudentId: "examStudent",
      adoptedQuestionScoreId: "score",
    },
    colleagueAttempt: { runId: "colleagueRun", examStudentId: "examStudent" },
  },
}

const tableRows = new Map(
  Object.entries(SYNTHETIC_ROWS).map(([table, rowsById]) => {
    const columns = (ARCHIVE_TABLES[table]?.references ?? []).map(
      (reference) => reference.column
    )
    return [
      table,
      new Map(
        Object.entries(rowsById).map(([id, foreignKeys]) => [
          id,
          {
            id,
            values: Object.fromEntries([
              ["id", id],
              ...columns.map((column) => [column, foreignKeys[column] ?? null]),
            ]),
          },
        ])
      ),
    ]
  })
)

const AI_TABLES = ["AiPrompt", "AiGradingRun", "AiGradingAttempt"]

const includedIds = (selection: ArchiveSelection) => {
  const scope = resolveArchiveScope(tableRows, selection)
  return Object.fromEntries(
    AI_TABLES.map((table) => [table, [...(scope.rows.get(table) ?? [])].sort()])
  )
}

describe("AI 採点の記録の範囲", () => {
  it("選ばなければ入らない", () => {
    expect(includedIds({ roots: { Exam: ["exam"] } })).toEqual({
      AiPrompt: [],
      AiGradingRun: [],
      AiGradingAttempt: [],
    })
  })

  it("選べば、試験の設問のプロンプト・実行・判定が全員分入る", () => {
    expect(
      includedIds({
        roots: { Exam: ["exam"] },
        optionalItems: ["aiGradingRecords"],
      })
    ).toEqual({
      AiPrompt: ["firstPrompt", "revisedPrompt"],
      AiGradingRun: ["colleagueRun", "teacherRun"],
      AiGradingAttempt: ["colleagueAttempt", "teacherAttempt"],
    })
  })

  it("採点と答案を外すと、判定だけが外れる", () => {
    expect(
      includedIds({
        roots: { Exam: ["exam"] },
        includeAnswers: false,
        optionalItems: ["aiGradingRecords"],
      })
    ).toEqual({
      AiPrompt: ["firstPrompt", "revisedPrompt"],
      AiGradingRun: ["colleagueRun", "teacherRun"],
      AiGradingAttempt: [],
    })
  })

  it("本人分だけにすると、他の教員の実行と判定が外れ、プロンプトは残る", () => {
    expect(
      includedIds({
        roots: { Exam: ["exam"] },
        scoring: { kind: "self", userId: "teacher" },
        optionalItems: ["aiGradingRecords"],
      })
    ).toEqual({
      AiPrompt: ["firstPrompt", "revisedPrompt"],
      AiGradingRun: ["teacherRun"],
      AiGradingAttempt: ["teacherAttempt"],
    })
  })

  it("採用先の採点が外れたら、判定は残して採用先だけを NULL にする", () => {
    const scope = resolveArchiveScope(tableRows, {
      roots: { Exam: ["exam"] },
      exclusions: { QuestionScore: ["score"] },
      optionalItems: ["aiGradingRecords"],
    })
    expect(scope.rows.get("AiGradingAttempt")?.has("teacherAttempt")).toBe(true)
    expect(scope.nulledReferences).toContainEqual({
      table: "AiGradingAttempt",
      id: "teacherAttempt",
      column: "adoptedQuestionScoreId",
    })
  })
})

describe("AI 採点の記録の「別で追加」での振り直し", () => {
  it("試験を振り直すと、プロンプト・実行・判定も振り直る（利用者と生徒は振り直さない）", () => {
    const idMap = renumberSeparateRows(
      [...tableRows].map(([table, rowsById]) => ({
        table,
        columns: [],
        rows: [...rowsById.values()],
      }))
    )
    for (const table of AI_TABLES) {
      expect(Object.keys(idMap[table] ?? {}).sort(), table).toEqual(
        Object.keys(SYNTHETIC_ROWS[table]).sort()
      )
    }
    expect(idMap.User).toBeUndefined()
    expect(idMap.Student).toBeUndefined()
  })
})
