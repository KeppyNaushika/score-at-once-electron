/**
 * マッチングロジックモジュール
 *
 * インポートデータと既存データのマッチングを行う
 */

import prisma from "../../prisma/client"
import type {
  MatchingConfig,
  StudentMatchingMethod,
  ClassMatchingMethod,
  UserMatchingMethod,
  SubtotalGroupMatchingMethod,
} from "../../../../types/projectArchive.types"
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
  studentId: string
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

    switch (method) {
      case "uuid":
        matchedStudent =
          existingStudents.find((s) => s.id === importStudent.id) ?? null
        break

      case "studentId":
        matchedStudent =
          existingStudents.find(
            (s) => s.studentId === importStudent.studentId
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

    results.push({
      importData: {
        id: importStudent.id,
        studentId: importStudent.studentId,
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
            studentId: matchedStudent.studentId,
            lastName: matchedStudent.lastName,
            firstName: matchedStudent.firstName,
            lastNameKana: matchedStudent.lastNameKana,
            firstNameKana: matchedStudent.firstNameKana,
            enrollmentYear: matchedStudent.enrollmentYear,
            updatedAt: matchedStudent.updatedAt,
          }
        : null,
      matchType: matchedStudent
        ? matchedStudent.id === importStudent.id
          ? "exact"
          : "fuzzy"
        : "new",
    })
  }

  return results
}

/**
 * 学級データのマッチングを実行
 */
export async function matchClasses(
  importData: ExtractedArchiveData,
  method: ClassMatchingMethod
): Promise<MatchResult<ClassData>[]> {
  const results: MatchResult<ClassData>[] = []

  const existingClasses = await prisma.class.findMany()

  for (const importClass of importData.classesData.classes) {
    let matchedClass: (typeof existingClasses)[0] | null = null

    switch (method) {
      case "uuid":
        matchedClass =
          existingClasses.find((c) => c.id === importClass.id) ?? null
        break

      case "name":
        matchedClass =
          existingClasses.find((c) => c.name === importClass.name) ?? null
        break
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
      matchType: matchedClass
        ? matchedClass.id === importClass.id
          ? "exact"
          : "fuzzy"
        : "new",
    })
  }

  return results
}

/**
 * ユーザーデータのマッチングを実行
 */
export async function matchUsers(
  importData: ExtractedArchiveData,
  method: UserMatchingMethod
): Promise<MatchResult<UserData>[]> {
  const results: MatchResult<UserData>[] = []

  const existingUsers = await prisma.user.findMany()

  for (const importUser of importData.usersData.users) {
    let matchedUser: (typeof existingUsers)[0] | null = null

    switch (method) {
      case "uuid":
        matchedUser = existingUsers.find((u) => u.id === importUser.id) ?? null
        break

      case "username":
        matchedUser =
          existingUsers.find((u) => u.username === importUser.username) ?? null
        break
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
      matchType: matchedUser
        ? matchedUser.id === importUser.id
          ? "exact"
          : "fuzzy"
        : "new",
    })
  }

  return results
}

/**
 * 小計グループデータのマッチングを実行
 */
export async function matchSubtotalGroups(
  importData: ExtractedArchiveData,
  method: SubtotalGroupMatchingMethod
): Promise<MatchResult<SubtotalGroupData>[]> {
  const results: MatchResult<SubtotalGroupData>[] = []

  const existingGroups = await prisma.subtotalGroup.findMany()

  for (const importGroup of importData.subtotalsData.subtotalGroups) {
    let matchedGroup: (typeof existingGroups)[0] | null = null

    switch (method) {
      case "uuid":
        matchedGroup =
          existingGroups.find((g) => g.id === importGroup.id) ?? null
        break

      case "name":
        matchedGroup =
          existingGroups.find((g) => g.name === importGroup.name) ?? null
        break
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
      matchType: matchedGroup
        ? matchedGroup.id === importGroup.id
          ? "exact"
          : "fuzzy"
        : "new",
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
