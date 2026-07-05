import type { ReactNode } from "react"

/**
 * 名簿テーブル共通部品の型
 *
 * 試験(exam)・成績(grade)・試験外成績資料(coursework)の名簿テーブルを
 * スロット方式で統合するための正規化型とアダプター/スロットの定義。
 */

/** 正規化された学級情報 */
export interface RosterClassroomInfo {
  className: string | null
  classroomCode?: string | null
  grade?: number | null
  attendanceNumber: number | null
  /** 学級（ExamClassroom/GradeClassroom 等）の並び順 */
  classroomOrder?: number | null
}

/** 名簿テーブルの正規化された1行 */
export interface RosterRow {
  /** studentId（並び替え・選択・DnD のキー） */
  id: string
  studentNumber: string
  lastName: string
  firstName: string
  /** ふりがな（姓名連結済み。無い場合は空文字） */
  kana: string
  classroomInfo: RosterClassroomInfo
  customOrder?: number | null
}

/** フィルタ用の学級候補 */
export interface RosterClassroomOption {
  id: string
  name: string
}

/** 追加列の定義（ヘッダー＋セル） */
export interface RosterColumn {
  /** 一意なキー */
  key: string
  /** ヘッダーラベル */
  header: ReactNode
  /** 行ごとのセル内容 */
  cell: (row: RosterRow) => ReactNode
  /** ヘッダーセルに付与する className */
  headerClassName?: string
  /** データセルに付与する className */
  cellClassName?: string
}

/** 追加フィルタの定義（フィルタ行に差し込む UI と行への適用判定） */
export interface RosterFilter {
  /** フィルタ行に描画する UI */
  render: () => ReactNode
  /** 行がこのフィルタに合致するか（false で除外） */
  predicate: (row: RosterRow) => boolean
}

/**
 * 名簿データのアダプター
 *
 * 各画面が自前データ→RosterRow のマッパーとともに供給する。
 */
export interface RosterTableAdapter {
  /** 名簿行を取得 */
  fetchRows: () => Promise<RosterRow[]>
  /** フィルタ用の学級候補を取得 */
  fetchClassrooms: () => Promise<RosterClassroomOption[]>
  /** 並び順を更新（customOrder の連番を保存） */
  updateRowOrder: (
    rowOrders: { studentId: string; customOrder: number }[]
  ) => Promise<void>
  /** 行（生徒）を削除 */
  removeRows: (studentIds: string[]) => Promise<void>
}

/**
 * 名簿テーブルのスロット（各画面が任意で差し込む）
 *
 * 未指定時は素の名簿として動作する。
 */
export interface RosterTableSlots {
  /** 追加列（例: 答案枚数・受験状態） */
  additionalColumns?: RosterColumn[]
  /** 追加フィルタ（例: 受験状態フィルタ） */
  additionalFilters?: RosterFilter[]
  /**
   * 行アクションボタン列（例: 受験状態ボタン）。
   * 指定時は専用列としてテーブル末尾に追加される。
   */
  rowActionButtons?: {
    header: ReactNode
    render: (row: RosterRow) => ReactNode
    headerClassName?: string
    cellClassName?: string
  }
  /**
   * 削除前のガード。false を返すと共通側の削除は行わない
   * （ホスト側で確認モーダルを出すなどに使う）。
   */
  onBeforeRemove?: (studentIds: string[]) => Promise<boolean> | boolean
}
