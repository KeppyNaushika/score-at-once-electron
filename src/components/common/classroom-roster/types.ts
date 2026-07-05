import type { ReactNode } from "react"

/**
 * 共通学級登録UI（ClassroomRosterManager）の型定義。
 *
 * 試験(Exam)・成績(Grade)・資料(Coursework)の3エンティティで、学級の
 * 登録一覧・並び替え・追加・削除を共通化するための正規化された形。
 * テーブル固有の I/O は各コンテナがコールバックで供給する。
 */

/** 登録済み学級1件（リンクID＋表示に必要な学級情報） */
export interface ClassroomRosterEntry {
  /** リンクのID（examClassroomId / gradeClassroom.id / courseworkClassroom.id） */
  id: string
  /** 学級ID（Classroom.id） */
  classroomId: string
  /** 学級名 */
  name: string
  /** 学級コード（任意） */
  classroomCode?: string | null
  /** 学年（任意） */
  grade?: number | null
  /** 登録時点の所属生徒数 */
  studentCount: number
  /** 並び順 */
  order: number
}

/** 追加ダイアログに出す候補学級 */
export interface AvailableClassroomOption {
  id: string
  name: string
  classroomCode?: string | null
  grade?: number | null
  studentCount: number
}

/**
 * エンティティ固有のフラグ列（試験の「再採番(administered)」など）。
 * 成績・資料はフラグ列を持たない（空配列）。
 */
export interface ClassroomRosterFlagColumn {
  /** 列の識別子 */
  key: string
  /** ヘッダー表示 */
  header: ReactNode
  /** その学級の現在値 */
  checked: (entry: ClassroomRosterEntry) => boolean
  /** チェック変更時 */
  onChange: (
    entry: ClassroomRosterEntry,
    checked: boolean
  ) => void | Promise<void>
}

/**
 * 学級削除のモード。
 * - `unlink-only`: 登録を解除するだけ（生徒は残す）。試験はこちら（採点データは05で管理）。
 * - `can-delete-students`: 登録解除に加え、その学級にのみ所属する生徒も削除できる。成績・資料。
 */
export type ClassroomRemovalMode = "unlink-only" | "can-delete-students"

/** 削除プレビュー（その学級にのみ所属する＝削除対象になる生徒数） */
export interface ClassroomRemovalPreview {
  exclusiveCount: number
}
