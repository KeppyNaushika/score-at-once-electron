/**
 * マッチャー共通型定義
 */

import type { Classroom, Student, SubtotalGroup, User } from "@prisma/client"

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

/**
 * 照合対象の最小射影。既存側は Prisma 行、インポート側はアーカイブ由来。
 * identity/属性は各モデルに追随（Prisma 派生）し、updatedAt のみアーカイブが
 * ISO 文字列で持つため `string | Date` に広げる。
 * Prisma 派生の型エイリアスは `MatchResult<T extends Record<string, unknown>>` 制約を充足する。
 */

/** 生徒データ */
export type MatchStudentData = Pick<
  Student,
  | "id"
  | "studentNumber"
  | "lastName"
  | "firstName"
  | "lastNameKana"
  | "firstNameKana"
  | "enrollmentYear"
> & { updatedAt: string | Date }

/** 学級データ */
export type ClassroomData = Pick<
  Classroom,
  "id" | "name" | "classroomCode" | "grade" | "description"
> & { updatedAt: string | Date }

/** ユーザーデータ */
export type UserData = Pick<User, "id" | "username" | "name" | "role"> & {
  updatedAt: string | Date
}

/** 小計グループデータ */
export type SubtotalGroupData = Pick<SubtotalGroup, "id" | "name"> & {
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
