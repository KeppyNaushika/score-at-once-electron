/**
 * マッチングロジックモジュール
 *
 * インポートデータと既存データのマッチングを行う
 */

import type {
  FileOverviewData,
  MatchingConfig,
  ProjectPreMatchingResult,
} from "../../../../types/projectArchive.types"
import prisma from "../../prisma/client"
import type { ExtractedArchiveData } from "../project-archive/archiveExtractor"
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

/**
 * IDマッピングを生成（既存データへのマッピング）
 */
export function buildIdMappings(matchResults: AllMatchResults): {
  student: Record<string, string>
  class: Record<string, string>
  user: Record<string, string>
  subtotalGroup: Record<string, string>
} {
  const studentMapping: Record<string, string> = {}
  const classMapping: Record<string, string> = {}
  const userMapping: Record<string, string> = {}
  const subtotalGroupMapping: Record<string, string> = {}

  // 生徒のマッピング
  for (const result of matchResults.students) {
    if (result.existingData) {
      studentMapping[result.importData.id] = result.existingData.id
    }
  }

  // 学級のマッピング
  for (const result of matchResults.classes) {
    if (result.existingData) {
      classMapping[result.importData.id] = result.existingData.id
    }
  }

  // ユーザーのマッピング
  for (const result of matchResults.users) {
    if (result.existingData) {
      userMapping[result.importData.id] = result.existingData.id
    }
  }

  // 小計グループのマッピング
  for (const result of matchResults.subtotalGroups) {
    if (result.existingData) {
      subtotalGroupMapping[result.importData.id] = result.existingData.id
    }
  }

  return {
    student: studentMapping,
    class: classMapping,
    user: userMapping,
    subtotalGroup: subtotalGroupMapping,
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
  const [studentResult, classResult, subtotalGroupResult, projectResult] =
    await Promise.all([
      preMatchStudents(importData),
      preMatchClasses(importData),
      preMatchSubtotalGroups(importData),
      preMatchProject(importData),
    ])

  return {
    student: studentResult,
    class: classResult,
    subtotalGroup: subtotalGroupResult,
    project: projectResult,
  }
}

/**
 * プロジェクトの事前照合
 *
 * プロジェクトIDが既存データベースに存在するかチェック。
 * ID一致 = 同じPCでエクスポートしたデータ → マージ可能
 */
async function preMatchProject(
  importData: ExtractedArchiveData
): Promise<ProjectPreMatchingResult> {
  const importProject = importData.projectData.project

  // ID照合
  const existingProject = await prisma.project.findUnique({
    where: { id: importProject.id },
  })

  if (existingProject) {
    return {
      isIdMatch: true,
      importProjectId: importProject.id,
      existingProjectId: existingProject.id,
      importData: importProject as unknown as Record<string, unknown>,
      existingData: existingProject as unknown as Record<string, unknown>,
      displayLabel: importProject.examName,
    }
  }

  return {
    isIdMatch: false,
    importProjectId: importProject.id,
    importData: importProject as unknown as Record<string, unknown>,
    displayLabel: importProject.examName,
  }
}
