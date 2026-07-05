/**
 * マッチャー共通型定義
 */

/**
 * マッチング結果
 */
export interface MatchResult<T extends Record<string, unknown>> {
  /** インポートデータ */
  importData: T
  /** マッチした既存データ（なければnull） */
  existingData: T | null
  /** マッチタイプ */
  matchType: "exact" | "fuzzy" | "new"
}

/** 生徒データ */
export interface MatchStudentData {
  [key: string]: unknown
  id: string
  studentNumber: string
  lastName: string
  firstName: string
  lastNameKana: string
  firstNameKana: string
  enrollmentYear: number | null
  updatedAt: string | Date
}

/** 学級データ */
export interface ClassroomData {
  [key: string]: unknown
  id: string
  name: string
  classroomCode: string | null
  grade: number | null
  description: string | null
  updatedAt: string | Date
}

/** ユーザーデータ */
export interface UserData {
  [key: string]: unknown
  id: string
  username: string
  name: string
  role: string
  updatedAt: string | Date
}

/** 小計グループデータ */
export interface SubtotalGroupData {
  [key: string]: unknown
  id: string
  name: string
  updatedAt: string | Date
}

/**
 * 全カテゴリのマッチング結果
 */
export interface AllMatchResults {
  students: MatchResult<MatchStudentData>[]
  classes: MatchResult<ClassroomData>[]
  users: MatchResult<UserData>[]
  subtotalGroups: MatchResult<SubtotalGroupData>[]
}
