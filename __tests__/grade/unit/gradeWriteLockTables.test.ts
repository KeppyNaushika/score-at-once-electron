/**
 * 成績算出のロックが止めるテーブルを、成績算出が実際に読むものから導けていることの検証。
 *
 * 1. **止めるテーブルの中身。** 点数・配点・受験者・資料の点数など成績算出の入力を含み、
 *    出力設定・タグ・メンバー・採点担当・注釈・監査ログ・利用者の設定を含まない
 * 2. **導き方が読むものに追従する。** 読むもの（問い合わせ口 → include）を変えると、
 *    導かれるモデルも変わる（型の上で確かめる。`tsc` が検査する）
 * 3. **成績算出は `gradeCalculationReads` に無い問い合わせを立てない。** 立てると、
 *    その分はロックの計算から漏れる
 * 4. **SQL の書き込み先の読み取り**
 */

import * as fs from "fs"
import * as path from "path"
import { describe, expect, expectTypeOf, it } from "vitest"

import {
  GRADE_CALCULATION_TABLES,
  type ModelsReadBy,
  writeTargetOf,
} from "../../../electron-src/lib/prisma/gradeWriteLock"
import { gradeCalculationReads } from "../../../electron-src/lib/shared/calculations/gradeCalculatorTypes"

describe("成績算出のロックが止めるテーブル", () => {
  it("成績算出の入力になるテーブルを含む", () => {
    for (const table of [
      "Exam",
      "ExamPage",
      "CropRegion",
      "ExamStudent",
      "QuestionScore",
      "ScoreDecision",
      "Subtotal",
      "CropSubtotal",
      "Coursework",
      "CourseworkItem",
      "CourseworkScore",
      "CourseworkStudent",
      "CourseworkLetterScale",
      "Grade",
      "GradeItem",
      "GradeDataSource",
      "GradeStudent",
      "GradeOverride",
      "GradeFrozenScore",
      "Student",
    ]) {
      expect(GRADE_CALCULATION_TABLES.has(table), table).toBe(true)
    }
  })

  it("成績算出が読まないテーブルは含まない", () => {
    for (const table of [
      "AuditLog",
      "UserExam",
      "User",
      "ExamClassroom",
      "ExamSubtotalGroup",
      "SubtotalGroup",
      "Tag",
      "ExamTag",
      "DrawingAnnotation",
      "CropRegionAssignment",
      "ReturnSnapshot",
      "ExamAnswerOverlayStyle",
      "ExamIndividualReportSettings",
      // 成績算出の出力設定（通知書の設定・出力に載せる比較の選択）
      "GradeIndividualReportSettings",
      "GradeExportComparison",
      "UserPreference",
      "UserKeyboardShortcut",
    ]) {
      expect(GRADE_CALCULATION_TABLES.has(table), table).toBe(false)
    }
  })

  it("読むものを変えると、導かれるモデルも変わる", () => {
    // 受験者と採点行だけ読むなら、その2つ
    expectTypeOf<
      ModelsReadBy<{ examStudent: { questionScores: true } }>
    >().toEqualTypeOf<"ExamStudent" | "QuestionScore">()
    // 返却の控えまで読み始めれば、それもロックの対象に入る
    expectTypeOf<
      ModelsReadBy<{
        examStudent: { questionScores: true; returnSnapshots: true }
      }>
    >().toEqualTypeOf<"ExamStudent" | "QuestionScore" | "ReturnSnapshot">()
    // 入れ子の include と、関係を使う where も辿る
    expectTypeOf<
      ModelsReadBy<{
        cropRegion: {
          examPage: { include: { exam: true } }
          cropSubtotals: { where: { subtotal: { name: "a" } } }
        }
      }>
    >().toEqualTypeOf<
      "CropRegion" | "ExamPage" | "Exam" | "CropSubtotal" | "Subtotal"
    >()
  })

  it("成績算出は gradeCalculationReads の問い合わせ口だけを使う", () => {
    // 成績算出を成すファイル全部を見る。DB を読むのは文脈の組み立てだけだが、
    // 算出や適合度の側に問い合わせが足されても、ここで捕まえる
    const source = [
      "gradeCalculator.ts",
      "gradeCalculationContext.ts",
      "gradeSourceFit.ts",
    ]
      .map((fileName) =>
        fs.readFileSync(
          path.resolve(
            __dirname,
            "../../../electron-src/lib/shared/calculations",
            fileName
          ),
          "utf8"
        )
      )
      .join("\n")
    const delegates = [...source.matchAll(/\bprisma\.(\w+)\./g)].map(
      (match) => match[1]
    )
    expect(delegates.length).toBeGreaterThan(0)
    for (const delegate of delegates) {
      expect(Object.keys(gradeCalculationReads), delegate).toContain(delegate)
      // include もそこから取る（手で別の include を書かない）
      expect(source).toContain(`include: gradeCalculationReads.${delegate}`)
    }
  })
})

describe("SQL の書き込み先", () => {
  it("Prisma が発行する書き込みの文から、書き込み先のテーブルを読む", () => {
    expect(
      writeTargetOf(
        "INSERT INTO `main`.`QuestionScore` (`id`) VALUES (?) RETURNING `id`"
      )
    ).toBe("QuestionScore")
    expect(
      writeTargetOf("UPDATE `main`.`Exam` SET `examName` = ? WHERE 1=1")
    ).toBe("Exam")
    expect(writeTargetOf("DELETE FROM `main`.`Tag` WHERE 1=1")).toBe("Tag")
    expect(writeTargetOf('INSERT OR REPLACE INTO "CropRegion" (id)')).toBe(
      "CropRegion"
    )
  })

  it("読むだけの文は書き込みとみなさない", () => {
    expect(
      writeTargetOf("SELECT `updatedAt` FROM `main`.`Exam` WHERE `id` = ?")
    ).toBeNull()
    expect(writeTargetOf("BEGIN")).toBeNull()
    expect(writeTargetOf("COMMIT")).toBeNull()
  })

  it("書き込み先を頭で読めない書き込みは、読めないものとして返す", () => {
    expect(
      writeTargetOf("WITH t AS (SELECT 1) UPDATE `main`.`Exam` SET x = 1")
    ).toBe("?")
  })
})
