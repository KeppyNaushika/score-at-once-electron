/**
 * 試験外成績資料（Coursework）の共有型定義
 *
 * Coursework は Exam / SubtotalGroup と同階層のトップレベル実体。
 * 評価項目（CourseworkItem）単位で成績算出（GradeDataSource）から参照される。
 */

/** 評価項目の入力モード（"numeric" | "letter"） */
export type InputMode = "numeric" | "letter"

/** 文字評価→点数の変換表エントリ（評価項目単位） */
export interface CourseworkLetterScaleData {
  id: string
  courseworkItemId: string
  label: string
  score: number
  order: number
}

/** 生徒×評価項目の点数（生徒情報付き） */
export interface CourseworkScoreWithStudent {
  id: string
  courseworkItemId: string
  studentId: string
  score: number | null
  /** 文字モード時の評価記号 */
  letterValue: string | null
  /** 加点・減点（期限超過等） */
  adjustment: number | null
  /** 加減点の理由 */
  adjustmentReason: string | null
  /** 成績通知書に表示するコメント */
  comment: string | null
  student: {
    id: string
    studentNumber: string
    lastName: string
    firstName: string
  }
}

/** 評価項目（リレーション付き） */
export interface CourseworkItemWithDetails {
  id: string
  courseworkId: string
  name: string
  order: number
  maxScore: number
  inputMode: InputMode
  createdAt: Date
  updatedAt: Date
  /** 文字評価→点数の変換表（letterモード時に使用） */
  letterScales: CourseworkLetterScaleData[]
  _count?: { scores: number; gradeDataSources: number }
}

/** 試験外成績資料（リレーション付き） */
export interface CourseworkWithDetails {
  id: string
  name: string
  description: string | null
  date: string | null
  createdAt: Date
  updatedAt: Date
  classes: {
    id: string
    classroomId: string
    classroom: { id: string; name: string }
    order: number
  }[]
  tags: {
    id: string
    tagId: string
    tag: { id: string; name: string; color: string | null }
  }[]
  items: CourseworkItemWithDetails[]
  _count?: {
    items: number
    students: number
  }
}

/** 名簿1行（生徒・所属付き） */
export interface CourseworkStudentWithDetails {
  id: string
  courseworkId: string
  studentId: string
  customOrder: number | null
  student: {
    id: string
    studentNumber: string
    lastName: string
    firstName: string
    lastNameKana: string
    firstNameKana: string
    memberships: {
      classroomId: string
      attendanceNumber: number | null
      classroom: { id: string; name: string }
    }[]
  }
}

/** 一覧表示用の軽量サマリ */
export interface CourseworkSummary {
  id: string
  name: string
  description: string | null
  date: string | null
  createdAt: Date
  updatedAt: Date
  _count: {
    items: number
    students: number
  }
}
