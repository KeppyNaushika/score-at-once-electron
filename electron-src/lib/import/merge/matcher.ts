/**
 * マッチングロジックモジュール
 *
 * インポートデータと既存データのマッチングを行う
 */

import type {
  ExamPreMatchingResult,
  FileOverviewData,
  MatchingConfig,
} from "../../../../src/types/examArchive.types"
import prisma from "../../prisma/client"
import type { ExtractedArchiveData } from "../exam-archive/archiveExtractor"
import {
  type AllMatchResults,
  type ClassData,
  matchClasses,
  type MatchResult,
  matchStudents,
  matchSubtotalGroups,
  matchUsers,
  preMatchClasses,
  preMatchStudents,
  preMatchSubtotalGroups,
  type StudentData,
  type SubtotalGroupData,
  type UserData,
} from "./matchers"
import {
  detectScoringConflicts,
  detectScoringConflictsWithUserDecisions,
} from "./scoringConflictDetector"

// 型の再エクスポート
export type {
  AllMatchResults,
  ClassData,
  MatchResult,
  StudentData,
  SubtotalGroupData,
  UserData,
}

// 関数の再エクスポート
export {
  detectScoringConflicts,
  detectScoringConflictsWithUserDecisions,
  matchClasses,
  matchStudents,
  matchSubtotalGroups,
  matchUsers,
}

/**
 * 全カテゴリのマッチングを実行
 */
export async function performAllMatching(
  importData: ExtractedArchiveData,
  config: MatchingConfig
): Promise<AllMatchResults> {
  const [students, classes, users, subtotalGroups] = await Promise.all([
    matchStudents(importData, config.student),
    matchClasses(importData, config.class),
    matchUsers(importData, config.user),
    matchSubtotalGroups(importData, config.subtotalGroup),
  ])

  return {
    students,
    classes,
    users,
    subtotalGroups,
  }
}

// =============================================================================
// 事前照合（Step 2: ファイル概要表示用）
// =============================================================================

/**
 * 事前照合を実行し、FileOverviewData形式で返す
 *
 * 全ての照合方法（ID、学籍番号、氏名、名前）で照合を実行し、
 * ID一致と不一致を分類する。Step 2で概要表示に使用。
 *
 * 注意: 採点競合検出はここでは行わない。
 * ユーザーがid_integrationで判断した後に、別途detectScoringConflictsWithUserDecisionsを呼ぶ。
 */
export async function performPreMatching(
  importData: ExtractedArchiveData
): Promise<FileOverviewData> {
  const [studentResult, classResult, subtotalGroupResult, examResult] =
    await Promise.all([
      preMatchStudents(importData),
      preMatchClasses(importData),
      preMatchSubtotalGroups(importData),
      preMatchExam(importData),
    ])

  return {
    student: studentResult,
    class: classResult,
    subtotalGroup: subtotalGroupResult,
    exam: examResult,
  }
}

/**
 * 試験の事前照合
 *
 * 試験IDが既存データベースに存在するかチェック。
 * ID一致 = 同じPCでエクスポートしたデータ → マージ可能
 */
async function preMatchExam(
  importData: ExtractedArchiveData
): Promise<ExamPreMatchingResult> {
  const importExam = importData.examData.exam

  // ID照合
  const existingExam = await prisma.exam.findUnique({
    where: { id: importExam.id },
  })

  if (existingExam) {
    return {
      isIdMatch: true,
      importExamId: importExam.id,
      existingExamId: existingExam.id,
      importData: { ...importExam },
      existingData: { ...existingExam },
      displayLabel: importExam.examName,
    }
  }

  return {
    isIdMatch: false,
    importExamId: importExam.id,
    importData: { ...importExam },
    displayLabel: importExam.examName,
  }
}
