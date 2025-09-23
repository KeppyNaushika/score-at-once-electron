import type { PageImage, Student } from "@prisma/client"

export type Id = string
export type ProjectId = Id
export type SheetId = Id
export type QuestionId = Id
export type StudentId = Id

export interface CropCoords {
  top: number
  bottom: number
  left: number
  right: number
}

export interface QuestionTag {
  name: string
  isEnabled: boolean
}

export interface GeneralQuestion {
  tags: [QuestionTag[]] // Consider if this nesting is intended: Tag[][]
  projectId: ProjectId // Changed from examId
  questionId: QuestionId
  sheetId: SheetId
  crop: CropCoords
}

export type ProjectSortField = "examName" | "examDate" // These field names come from Project model in schema
export type SortDirection = "ascending" | "descending" | "none" | null

export interface ProjectSort {
  field: null | ProjectSortField
  sorted: null | SortDirection
}

export interface ClientTag {
  id: string // react-tag-input often prefers string IDs, Prisma's Tag ID is string.
  text: string
}

export interface ProjectListItem {
  // Renamed from ExamListItem
  selected: boolean
  name: string // Corresponds to Project.examName
  date: string // Corresponds to Project.examDate
}

export const MOVES = ["left", "right", "up", "down"] as const
const DIRECTION_TO_MOVE_ANSWER_AREA = [
  "prev",
  "next",
  "prevRow",
  "nextRow",
  "prevColumn",
  "nextColumn",
] as const

export type Move = (typeof MOVES)[number]

export type DirectionToMoveAnswerArea =
  (typeof DIRECTION_TO_MOVE_ANSWER_AREA)[number]

export interface AnswerArea {
  isSelected: boolean
  isShown: boolean
  index: number | null
  studentId: StudentId
  studentName: string
  maxPoints: number
  score: Score // Assuming Score type is defined elsewhere or intended to be
  partialPoints: number | null
  cropTmp: CropCoords
}

export type DragAction = "newAnswerArea" | "addAnswerArea" | "dragAnswerArea"

// Score 型の定義 (仮の定義、必要に応じて調整してください)
export type ScoreStatus =
  | "unscored"
  | "correct"
  | "incorrect"
  | "partial"
  | "pending"
  | "noanswer"

export interface Score {
  status: ScoreStatus
  points: number | null
}

export const CROP_REGION_AREA_TYPES = [
  "QUESTION_ANSWER",
  "STUDENT_NAME",
  "STUDENT_ID",
  "TOTAL_SCORE",
  "SUBTOTAL_SCORE",
  "MARK",
  "COMMENT",
  "OTHER",
] as const

export type CropRegionAreaType = (typeof CROP_REGION_AREA_TYPES)[number]

// 互換性のための旧名前
export const LAYOUT_REAGION_AREA_TYPES = CROP_REGION_AREA_TYPES
export type LayoutRegionAreaType = CropRegionAreaType

export interface CropRegionArea {
  id?: string
  projectPageId?: string // Updated: now references ProjectPage instead of projectId and masterImageId
  label: string
  type: CropRegionAreaType
  x: number
  y: number
  width: number
  height: number
  orderIndex?: number | null
  points?: number | string | null
  createdAt?: Date
  updatedAt?: Date
}

// 互換性のためのエイリアス（段階的移行用）
export type LayoutRegionArea = CropRegionArea

export type EditableTableRow = Record<string, string | number | boolean | null>

export interface EditableTableColumn<T extends EditableTableRow> {
  id: keyof T
  header: string
  getValue: () => T[keyof T]
  row: T
  column: {
    id: keyof T
    header: string
  }
  table: {
    data: T[]
    columns: EditableTableColumn<T>[]
  }
}

export interface ProjectWithDetails {
  id: string
  examName: string
  examDate: Date | null
  subject?: string
  description?: string
  createdAt: Date
  updatedAt: Date
  projectPages?: ProjectPageData[] // Updated: now uses ProjectPage instead of masterImages
  pageImages?: PageImageData[] // Updated: unified image management
  cropRegions?: CropRegionArea[] // Updated: renamed from layoutRegions
  tags?: TagData[]
  projectStudents?: ProjectStudentData[]
  userProjects?: UserProjectData[] // Added: many-to-many User-Project relation
  studentAnswers?: (PageImage & { student?: Student })[] // Added: student answers for project status checking
}

export interface ProjectStudentData {
  id: string
  projectId: string
  studentId: string
  status: string
  customOrder: number | null
  createdAt: Date
  updatedAt: Date
}

// Updated: MasterAnswerData replaced by ProjectPageData and PageImageData
export interface ProjectPageData {
  id: string
  projectId: string
  pageNumber: number
  createdAt: Date
  updatedAt: Date
  cropRegions?: CropRegionArea[]
  pageImages?: PageImageData[]
}

export interface PageImageData {
  id: string
  projectPageId: string
  studentId?: string | null // NULL for master images, student ID for answer images
  imagePath: string
  imageType: "MODEL_ANSWER" | "STUDENT_ANSWER"
  createdAt: Date
  updatedAt: Date
}

// Backward compatibility alias
export interface MasterAnswerData {
  id: string
  projectId: string
  imagePath: string
  pageNumber: number
  createdAt: Date
  updatedAt: Date
}

// Updated: StudentAnswerData simplified to match new schema
export interface StudentAnswerData {
  id: string
  projectId: string
  studentId?: string
  pageNumber: number
  originalImagePath: string // Main path field retained
  createdAt: Date
  updatedAt: Date
  questionScores?: QuestionScoreData[]
  // Removed fields: processedImagePath, scoredPdfPath, isScored, totalScore, isAbsent, version
}

// Updated: QuestionScoreData simplified to match new schema
export interface QuestionScoreData {
  id: string
  cropRegionId: string // Updated: renamed from layoutRegionId
  studentId?: string | null // Updated: now references student directly
  partialScore: number | null // Updated: simplified from string to number
  status: string // unscored, correct, incorrect, partial, no_answer
  scoredByUserId?: string | null
  createdAt: Date
  updatedAt: Date
  // Removed fields: studentAnswerId, comment, scoreVersion
}

export interface TagData {
  id: string
  text: string
}

export interface StudentData {
  id: string
  studentId: string
  name: string
  furigana?: string
  admissionYear?: number
  createdAt: Date
  updatedAt: Date
}

export interface CropRegionCreateData {
  projectPageId: string // Updated: now references ProjectPage instead of projectId and masterImageId
  label: string
  type:
    | "QUESTION_ANSWER"
    | "STUDENT_NAME"
    | "STUDENT_ID"
    | "TOTAL_SCORE"
    | "SUBTOTAL_SCORE"
    | "MARK"
    | "COMMENT"
    | "OTHER"
  x: number
  y: number
  width: number
  height: number
  orderIndex?: number
  points?: number
}

export interface CropRegionUpdateData {
  label?: string
  type?:
    | "QUESTION_ANSWER"
    | "STUDENT_NAME"
    | "STUDENT_ID"
    | "TOTAL_SCORE"
    | "SUBTOTAL_SCORE"
    | "MARK"
    | "COMMENT"
    | "OTHER"
  x?: number
  y?: number
  width?: number
  height?: number
  orderIndex?: number
  points?: number
}

export interface QuestionScoreCreateData {
  cropRegionId: string // Updated: primary reference
  studentId?: string | null // Updated: now references student directly
  partialScore?: number | null // Decimal型をnumberとして扱う
  scoredByUserId?: string | null
  status?: string // unscored, correct, incorrect, partial, no_answer
  // Removed: studentAnswerId, comment
}

export interface QuestionScoreUpdateData {
  partialScore?: number | null // Decimal型をnumberとして扱う
  status?: string // unscored, correct, incorrect, partial, no_answer
  // Removed: comment
}

// 互換性のためのエイリアス（段階的移行用）
export type LayoutRegionCreateData = CropRegionCreateData
export type LayoutRegionUpdateData = CropRegionUpdateData

export interface ScoringMarkConfig {
  position:
    | "top-left"
    | "top-center"
    | "top-right"
    | "center-left"
    | "center"
    | "center-right"
    | "bottom-left"
    | "bottom-center"
    | "bottom-right"
  size: number
  showCorrect: boolean
  showIncorrect: boolean
  showPartial: boolean
}

// Updated: New type definitions for refactored database structure

export interface UserProjectData {
  id: string
  userId: string
  projectId: string
  role: string // 'OWNER', 'GRADER', etc.
  createdAt: Date
  updatedAt: Date
}

export interface SubtotalGroupData {
  id: string
  name: string
  createdAt: Date
  updatedAt: Date
  subtotals?: SubtotalData[]
}

export interface SubtotalData {
  id: string
  name: string
  subtotalGroupId: string
  order: number
  createdAt: Date
  updatedAt: Date
}

export interface CropSubtotalData {
  id: string
  cropRegionId: string
  subtotalId: string
  assignmentType: "SUBTOTAL_DEFINITION" | "QUESTION_ASSIGNMENT"
  createdAt: Date
  updatedAt: Date
}

export interface ProjectSubtotalGroupData {
  id: string
  projectId: string
  subtotalGroupId: string
  createdAt: Date
  updatedAt: Date
}

// 新しいQuestion管理システムの型定義
