/**
 * マッチングロジックモジュール
 *
 * インポートデータと既存データのマッチングを行う
 */

import type {
  ClassMatchingMethod,
  FileOverviewData,
  IdIntegrationConfig,
  ImportItem,
  MatchedItem,
  MatchingConfig,
  PreMatchingResult,
  ProjectPreMatchingResult,
  ScoringConflict,
  ScoringConflictData,
  StudentMatchingMethod,
  SubtotalGroupMatchingMethod,
  UserMatchingMethod,
} from "../../../../types/projectArchive.types"
import prisma from "../../prisma/client"
import type { ExtractedArchiveData } from "../project-archive/archiveExtractor"

/**
 * マッチング結果
 */
export interface MatchResult<T> {
  /** インポートデータ */
  importData: T
  /** マッチした既存データ（なければnull） */
  existingData: T | null
  /** マッチタイプ */
  matchType: "exact" | "fuzzy" | "new"
}

/**
 * 全カテゴリのマッチング結果
 */
export interface AllMatchResults {
  students: MatchResult<StudentData>[]
  classes: MatchResult<ClassData>[]
  users: MatchResult<UserData>[]
  subtotalGroups: MatchResult<SubtotalGroupData>[]
}

// 内部型定義
interface StudentData {
  id: string
  studentNumber: string
  lastName: string
  firstName: string
  lastNameKana: string
  firstNameKana: string
  enrollmentYear: number | null
  updatedAt: string | Date
}

interface ClassData {
  id: string
  name: string
  classCode: string | null
  grade: number | null
  description: string | null
  updatedAt: string | Date
}

interface UserData {
  id: string
  username: string
  name: string
  role: string
  updatedAt: string | Date
}

interface SubtotalGroupData {
  id: string
  name: string
  updatedAt: string | Date
}

/**
 * 生徒データのマッチングを実行
 *
 * 照合の流れ:
 * 1. まずUUIDで照合（同じPCでエクスポート/インポートした場合に一致）
 * 2. UUIDが一致しない場合、methodで指定された二次照合を実行
 *    - "none": 二次照合しない（新規として扱う）
 *    - "studentNumber": 学籍番号で照合
 *    - "name": 氏名で照合
 */
export async function matchStudents(
  importData: ExtractedArchiveData,
  method: StudentMatchingMethod
): Promise<MatchResult<StudentData>[]> {
  const results: MatchResult<StudentData>[] = []

  // 既存の生徒を全て取得
  const existingStudents = await prisma.student.findMany()

  for (const importStudent of importData.studentsData.students) {
    let matchedStudent: (typeof existingStudents)[0] | null = null
    let isExactMatch = false

    // Step 1: UUIDで照合
    const uuidMatch = existingStudents.find((s) => s.id === importStudent.id)
    if (uuidMatch) {
      matchedStudent = uuidMatch
      isExactMatch = true
    }

    // Step 2: UUIDが一致しない場合、二次照合を実行
    if (!matchedStudent && method !== "none") {
      switch (method) {
        case "studentNumber":
          matchedStudent =
            existingStudents.find(
              (s) => s.studentNumber === importStudent.studentNumber
            ) ?? null
          break

        case "name":
          matchedStudent =
            existingStudents.find(
              (s) =>
                s.lastName === importStudent.lastName &&
                s.firstName === importStudent.firstName
            ) ?? null
          break
      }
    }

    results.push({
      importData: {
        id: importStudent.id,
        studentNumber: importStudent.studentNumber,
        lastName: importStudent.lastName,
        firstName: importStudent.firstName,
        lastNameKana: importStudent.lastNameKana,
        firstNameKana: importStudent.firstNameKana,
        enrollmentYear: importStudent.enrollmentYear,
        updatedAt: importStudent.updatedAt,
      },
      existingData: matchedStudent
        ? {
            id: matchedStudent.id,
            studentNumber: matchedStudent.studentNumber,
            lastName: matchedStudent.lastName,
            firstName: matchedStudent.firstName,
            lastNameKana: matchedStudent.lastNameKana,
            firstNameKana: matchedStudent.firstNameKana,
            enrollmentYear: matchedStudent.enrollmentYear,
            updatedAt: matchedStudent.updatedAt,
          }
        : null,
      matchType: matchedStudent ? (isExactMatch ? "exact" : "fuzzy") : "new",
    })
  }

  return results
}

/**
 * 学級データのマッチングを実行
 *
 * 照合の流れ:
 * 1. まずUUIDで照合
 * 2. UUIDが一致しない場合、methodで指定された二次照合を実行
 */
export async function matchClasses(
  importData: ExtractedArchiveData,
  method: ClassMatchingMethod
): Promise<MatchResult<ClassData>[]> {
  const results: MatchResult<ClassData>[] = []

  const existingClasses = await prisma.class.findMany()

  for (const importClass of importData.classesData.classes) {
    let matchedClass: (typeof existingClasses)[0] | null = null
    let isExactMatch = false

    // Step 1: UUIDで照合
    const uuidMatch = existingClasses.find((c) => c.id === importClass.id)
    if (uuidMatch) {
      matchedClass = uuidMatch
      isExactMatch = true
    }

    // Step 2: UUIDが一致しない場合、二次照合を実行
    if (!matchedClass && method !== "none") {
      switch (method) {
        case "name":
          matchedClass =
            existingClasses.find((c) => c.name === importClass.name) ?? null
          break
      }
    }

    results.push({
      importData: {
        id: importClass.id,
        name: importClass.name,
        classCode: importClass.classCode,
        grade: importClass.grade,
        description: importClass.description,
        updatedAt: importClass.updatedAt,
      },
      existingData: matchedClass
        ? {
            id: matchedClass.id,
            name: matchedClass.name,
            classCode: matchedClass.classCode,
            grade: matchedClass.grade,
            description: matchedClass.description,
            updatedAt: matchedClass.updatedAt,
          }
        : null,
      matchType: matchedClass ? (isExactMatch ? "exact" : "fuzzy") : "new",
    })
  }

  return results
}

/**
 * ユーザーデータのマッチングを実行
 *
 * 照合の流れ:
 * 1. まずUUIDで照合
 * 2. UUIDが一致しない場合、methodで指定された二次照合を実行
 */
export async function matchUsers(
  importData: ExtractedArchiveData,
  method: UserMatchingMethod
): Promise<MatchResult<UserData>[]> {
  const results: MatchResult<UserData>[] = []

  const existingUsers = await prisma.user.findMany()

  for (const importUser of importData.usersData.users) {
    let matchedUser: (typeof existingUsers)[0] | null = null
    let isExactMatch = false

    // Step 1: UUIDで照合
    const uuidMatch = existingUsers.find((u) => u.id === importUser.id)
    if (uuidMatch) {
      matchedUser = uuidMatch
      isExactMatch = true
    }

    // Step 2: UUIDが一致しない場合、二次照合を実行
    if (!matchedUser && method !== "none") {
      switch (method) {
        case "username":
          matchedUser =
            existingUsers.find((u) => u.username === importUser.username) ??
            null
          break
      }
    }

    results.push({
      importData: {
        id: importUser.id,
        username: importUser.username,
        name: importUser.name,
        role: importUser.role,
        updatedAt: importUser.updatedAt,
      },
      existingData: matchedUser
        ? {
            id: matchedUser.id,
            username: matchedUser.username,
            name: matchedUser.name,
            role: matchedUser.role,
            updatedAt: matchedUser.updatedAt,
          }
        : null,
      matchType: matchedUser ? (isExactMatch ? "exact" : "fuzzy") : "new",
    })
  }

  return results
}

/**
 * 小計グループデータのマッチングを実行
 *
 * 照合の流れ:
 * 1. まずUUIDで照合
 * 2. UUIDが一致しない場合、methodで指定された二次照合を実行
 */
export async function matchSubtotalGroups(
  importData: ExtractedArchiveData,
  method: SubtotalGroupMatchingMethod
): Promise<MatchResult<SubtotalGroupData>[]> {
  const results: MatchResult<SubtotalGroupData>[] = []

  const existingGroups = await prisma.subtotalGroup.findMany()

  for (const importGroup of importData.subtotalsData.subtotalGroups) {
    let matchedGroup: (typeof existingGroups)[0] | null = null
    let isExactMatch = false

    // Step 1: UUIDで照合
    const uuidMatch = existingGroups.find((g) => g.id === importGroup.id)
    if (uuidMatch) {
      matchedGroup = uuidMatch
      isExactMatch = true
    }

    // Step 2: UUIDが一致しない場合、二次照合を実行
    if (!matchedGroup && method !== "none") {
      switch (method) {
        case "name":
          matchedGroup =
            existingGroups.find((g) => g.name === importGroup.name) ?? null
          break
      }
    }

    results.push({
      importData: {
        id: importGroup.id,
        name: importGroup.name,
        updatedAt: importGroup.updatedAt,
      },
      existingData: matchedGroup
        ? {
            id: matchedGroup.id,
            name: matchedGroup.name,
            updatedAt: matchedGroup.updatedAt,
          }
        : null,
      matchType: matchedGroup ? (isExactMatch ? "exact" : "fuzzy") : "new",
    })
  }

  return results
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

/**
 * 生徒の事前照合
 */
async function preMatchStudents(
  importData: ExtractedArchiveData
): Promise<PreMatchingResult> {
  const existingStudents = await prisma.student.findMany()

  const byId: MatchedItem[] = []
  const byStudentNumber: MatchedItem[] = []
  const byName: MatchedItem[] = []
  const noMatch: ImportItem[] = []

  // 既存データをID別、学籍番号別、氏名別にインデックス化
  const existingById = new Map(existingStudents.map((s) => [s.id, s]))
  const existingByStudentNumber = new Map(
    existingStudents.map((s) => [s.studentNumber, s])
  )
  // 氏名は重複がありうるので、最初に見つかったものを使用
  const existingByName = new Map<string, (typeof existingStudents)[0]>()
  for (const s of existingStudents) {
    const key = `${s.lastName}|${s.firstName}`
    if (!existingByName.has(key)) {
      existingByName.set(key, s)
    }
  }

  for (const importStudent of importData.studentsData.students) {
    const displayLabel = `${importStudent.lastName}${importStudent.firstName}（${importStudent.studentNumber}）`
    const importItem: ImportItem = {
      importId: importStudent.id,
      importData: importStudent as unknown as Record<string, unknown>,
      displayLabel,
    }

    // ID照合
    const idMatch = existingById.get(importStudent.id)
    if (idMatch) {
      byId.push({
        importId: importStudent.id,
        existingId: idMatch.id,
        importData: importStudent as unknown as Record<string, unknown>,
        existingData: idMatch as unknown as Record<string, unknown>,
        displayLabel,
        matchReason: "同じパソコンで作成されたデータ",
      })
      continue
    }

    // 学籍番号照合（ID不一致の場合のみ）
    const studentNumberMatch = existingByStudentNumber.get(
      importStudent.studentNumber
    )
    if (studentNumberMatch) {
      byStudentNumber.push({
        importId: importStudent.id,
        existingId: studentNumberMatch.id,
        importData: importStudent as unknown as Record<string, unknown>,
        existingData: studentNumberMatch as unknown as Record<string, unknown>,
        displayLabel,
        matchReason: "学籍番号が一致",
      })
      continue
    }

    // 氏名照合（ID、学籍番号不一致の場合のみ）
    const nameKey = `${importStudent.lastName}|${importStudent.firstName}`
    const nameMatch = existingByName.get(nameKey)
    if (nameMatch) {
      byName.push({
        importId: importStudent.id,
        existingId: nameMatch.id,
        importData: importStudent as unknown as Record<string, unknown>,
        existingData: nameMatch as unknown as Record<string, unknown>,
        displayLabel,
        matchReason: "氏名が一致",
      })
      continue
    }

    // どれにも一致しない
    noMatch.push(importItem)
  }

  return {
    byId,
    byStudentNumber,
    byName,
    noMatch,
  }
}

/**
 * 学級の事前照合
 */
async function preMatchClasses(
  importData: ExtractedArchiveData
): Promise<PreMatchingResult> {
  const existingClasses = await prisma.class.findMany()

  const byId: MatchedItem[] = []
  const byName: MatchedItem[] = []
  const noMatch: ImportItem[] = []

  const existingById = new Map(existingClasses.map((c) => [c.id, c]))
  const existingByName = new Map(existingClasses.map((c) => [c.name, c]))

  for (const importClass of importData.classesData.classes) {
    const displayLabel = importClass.name
    const importItem: ImportItem = {
      importId: importClass.id,
      importData: importClass as unknown as Record<string, unknown>,
      displayLabel,
    }

    // ID照合
    const idMatch = existingById.get(importClass.id)
    if (idMatch) {
      byId.push({
        importId: importClass.id,
        existingId: idMatch.id,
        importData: importClass as unknown as Record<string, unknown>,
        existingData: idMatch as unknown as Record<string, unknown>,
        displayLabel,
        matchReason: "同じパソコンで作成されたデータ",
      })
      continue
    }

    // 名前照合
    const nameMatch = existingByName.get(importClass.name)
    if (nameMatch) {
      byName.push({
        importId: importClass.id,
        existingId: nameMatch.id,
        importData: importClass as unknown as Record<string, unknown>,
        existingData: nameMatch as unknown as Record<string, unknown>,
        displayLabel,
        matchReason: "学級名が一致",
      })
      continue
    }

    noMatch.push(importItem)
  }

  return {
    byId,
    byName,
    noMatch,
  }
}

/**
 * 小計グループの事前照合
 */
async function preMatchSubtotalGroups(
  importData: ExtractedArchiveData
): Promise<PreMatchingResult> {
  const existingGroups = await prisma.subtotalGroup.findMany()

  const byId: MatchedItem[] = []
  const byName: MatchedItem[] = []
  const noMatch: ImportItem[] = []

  const existingById = new Map(existingGroups.map((g) => [g.id, g]))
  const existingByName = new Map(existingGroups.map((g) => [g.name, g]))

  for (const importGroup of importData.subtotalsData.subtotalGroups) {
    const displayLabel = importGroup.name
    const importItem: ImportItem = {
      importId: importGroup.id,
      importData: importGroup as unknown as Record<string, unknown>,
      displayLabel,
    }

    // ID照合
    const idMatch = existingById.get(importGroup.id)
    if (idMatch) {
      byId.push({
        importId: importGroup.id,
        existingId: idMatch.id,
        importData: importGroup as unknown as Record<string, unknown>,
        existingData: idMatch as unknown as Record<string, unknown>,
        displayLabel,
        matchReason: "同じパソコンで作成されたデータ",
      })
      continue
    }

    // 名前照合
    const nameMatch = existingByName.get(importGroup.name)
    if (nameMatch) {
      byName.push({
        importId: importGroup.id,
        existingId: nameMatch.id,
        importData: importGroup as unknown as Record<string, unknown>,
        existingData: nameMatch as unknown as Record<string, unknown>,
        displayLabel,
        matchReason: "グループ名が一致",
      })
      continue
    }

    noMatch.push(importItem)
  }

  return {
    byId,
    byName,
    noMatch,
  }
}

// =============================================================================
// 採点結果の競合検出（Step 3.5: 採点結果の競合解決用）
// =============================================================================

/**
 * 採点結果の競合を検出
 *
 * 既存DBにある採点結果と、インポートデータの採点結果を比較し、
 * 同じ生徒×設問で異なる採点がある場合に競合として検出する。
 *
 * @param importData - 展開されたアーカイブデータ
 * @param studentIdMapping - 生徒IDのマッピング（インポートID → 既存ID）
 * @param cropRegionIdMapping - CropRegion IDのマッピング（インポートID → 既存ID）
 * @returns 採点競合データ
 */
export async function detectScoringConflicts(
  importData: ExtractedArchiveData,
  studentIdMapping: Record<string, string>,
  cropRegionIdMapping: Record<string, string>
): Promise<ScoringConflictData> {
  const conflicts: ScoringConflict[] = []
  let newCount = 0

  // マッピングされた既存のCropRegion IDリスト
  const existingCropRegionIds = Object.values(cropRegionIdMapping)
  if (existingCropRegionIds.length === 0) {
    // 全て新規プロジェクトの場合、競合なし
    return {
      conflictCount: 0,
      newCount: importData.scoresData.questionScores.length,
      conflicts: [],
    }
  }

  // 既存のQuestionScoreを取得（関連するCropRegionのみ）
  const existingScores = await prisma.questionScore.findMany({
    where: {
      cropRegionId: { in: existingCropRegionIds },
    },
    include: {
      cropRegion: true,
      student: true,
    },
  })

  // 既存スコアをキー（studentId + cropRegionId）でインデックス化
  const existingScoreMap = new Map<string, (typeof existingScores)[0]>()
  for (const score of existingScores) {
    const key = `${score.studentId}:${score.cropRegionId}`
    existingScoreMap.set(key, score)
  }

  // CropRegionのラベル・配点を取得
  const cropRegions = await prisma.cropRegion.findMany({
    where: { id: { in: existingCropRegionIds } },
  })
  const cropRegionMap = new Map(cropRegions.map((r) => [r.id, r]))

  // 生徒情報を取得
  const studentIds = Object.values(studentIdMapping)
  const students = await prisma.student.findMany({
    where: { id: { in: studentIds } },
  })
  const studentMap = new Map(students.map((s) => [s.id, s]))

  // インポートデータの各QuestionScoreについて競合をチェック
  for (const importScore of importData.scoresData.questionScores) {
    const mappedStudentId = importScore.studentId
      ? studentIdMapping[importScore.studentId]
      : null
    const mappedCropRegionId = cropRegionIdMapping[importScore.cropRegionId]

    if (!mappedStudentId || !mappedCropRegionId) {
      // マッピングがない場合は新規
      newCount++
      continue
    }

    const key = `${mappedStudentId}:${mappedCropRegionId}`
    const existingScore = existingScoreMap.get(key)

    if (!existingScore) {
      // 既存に存在しない場合は新規
      newCount++
      continue
    }

    // 既存と値が異なる場合は競合
    const importPartialScore = importScore.partialScore
      ? parseFloat(importScore.partialScore)
      : null
    const existingPartialScore = existingScore.partialScore
      ? Number(existingScore.partialScore)
      : null

    if (
      importScore.status !== existingScore.status ||
      importPartialScore !== existingPartialScore
    ) {
      const student = studentMap.get(mappedStudentId)
      const cropRegion = cropRegionMap.get(mappedCropRegionId)

      conflicts.push({
        importScoreId: importScore.id,
        existingScoreId: existingScore.id,
        studentName: student
          ? `${student.lastName}${student.firstName}`
          : "不明",
        studentId: mappedStudentId,
        questionLabel: cropRegion?.label ?? "不明",
        cropRegionId: mappedCropRegionId,
        importScore: {
          status: importScore.status,
          partialScore: importPartialScore,
          updatedAt: importScore.updatedAt,
        },
        existingScore: {
          status: existingScore.status,
          partialScore: existingPartialScore,
          updatedAt: existingScore.updatedAt.toISOString(),
        },
        maxPoints: cropRegion?.points ?? null,
      })
    }
    // 値が同じ場合は競合なし（既存を維持）
  }

  return {
    conflictCount: conflicts.length,
    newCount,
    conflicts,
  }
}

/**
 * ユーザーの判断に基づいて採点結果の競合を検出
 *
 * id_integrationステップでユーザーが「同じ人」と判断した生徒を含めて
 * 採点競合を検出する。
 *
 * @param importData - 展開されたアーカイブデータ
 * @param preMatchResult - 事前照合結果
 * @param integrationConfig - ユーザーのID統合設定
 * @returns 採点競合データ
 */
export async function detectScoringConflictsWithUserDecisions(
  importData: ExtractedArchiveData,
  preMatchResult: FileOverviewData,
  integrationConfig: IdIntegrationConfig
): Promise<ScoringConflictData> {
  // プロジェクトIDが一致しない場合、競合なし
  if (!preMatchResult.project?.isIdMatch) {
    return {
      conflictCount: 0,
      newCount: importData.scoresData.questionScores.length,
      conflicts: [],
    }
  }

  // 生徒IDマッピングを構築（ユーザーの判断を反映）
  const studentIdMapping: Record<string, string> = {}

  // 1. ID一致の生徒（自動でマッピング）
  for (const match of preMatchResult.student.byId) {
    studentIdMapping[match.importId] = match.existingId
  }

  // 2. ユーザーが「同じ人」と判断した生徒
  const studentConfig = integrationConfig.student

  // strategyに基づくデフォルトマッピング
  if (studentConfig.strategy === "by_student_number") {
    // 学籍番号一致のものをマッピング
    for (const match of preMatchResult.student.byStudentNumber ?? []) {
      if (!studentIdMapping[match.importId]) {
        studentIdMapping[match.importId] = match.existingId
      }
    }
  } else if (studentConfig.strategy === "by_name") {
    // 氏名一致のものをマッピング
    for (const match of preMatchResult.student.byName ?? []) {
      if (!studentIdMapping[match.importId]) {
        studentIdMapping[match.importId] = match.existingId
      }
    }
  }

  // 3. 個別のdecisionsでオーバーライド
  for (const decision of studentConfig.decisions) {
    if (decision.decisionType === "same_person" && decision.existingId) {
      studentIdMapping[decision.importId] = decision.existingId
    } else if (
      decision.decisionType === "create_new" ||
      decision.decisionType === "skip"
    ) {
      // 「新規作成」または「スキップ」の場合、マッピングから削除
      delete studentIdMapping[decision.importId]
    }
  }

  // CropRegionマッピングを構築（プロジェクトID一致時はID一致でマッピング）
  const cropRegionIdMapping: Record<string, string> = {}
  const existingCropRegions = await prisma.cropRegion.findMany({
    where: {
      projectPage: {
        projectId: preMatchResult.project.existingProjectId!,
      },
    },
  })
  const existingCropRegionIds = new Set(existingCropRegions.map((r) => r.id))

  for (const region of importData.projectData.cropRegions) {
    if (existingCropRegionIds.has(region.id)) {
      cropRegionIdMapping[region.id] = region.id
    }
  }

  // 競合を検出
  return detectScoringConflicts(importData, studentIdMapping, cropRegionIdMapping)
}
