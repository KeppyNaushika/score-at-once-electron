import type { PageImage, Student } from "@prisma/client"
import type { ProjectPayload } from "@/electron-src/lib/prisma/project"

// シリアライゼーション型変換ユーティリティ
// Date型をstring型に変換し、オブジェクトは再帰的に処理
type Serialized<T> = T extends Date
  ? string
  : T extends (infer U)[]
  ? Serialized<U>[]
  : T extends object
  ? { [K in keyof T]: Serialized<T[K]> }
  : T

// Prisma型ベースのシリアライゼーション済みProject型
export type SerializedProject = Serialized<ProjectPayload> & {
  // IPCハンドラーで平坦化されるcropRegions（questionScoresを含む）
  cropRegions?: Serialized<
    NonNullable<ProjectPayload['projectPages'][number]['cropRegions']>[number]
  >[]
  // IPCハンドラーで抽出されるanswerImages  
  answerImages?: {
    id: string
    projectPageId: string
    studentId: string | null
    imagePath: string
    imageType: string
    pageNumber: number
    createdAt: string
    updatedAt: string
    student?: Serialized<Student> | null
  }[]
}

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
  type: string // Changed from CropRegionAreaType to string for database compatibility
  x: number
  y: number
  width: number
  height: number
  orderIndex?: number | null
  points?: number | string | null
  createdAt?: Date
  updatedAt?: Date
  questionScores?: QuestionScoreData[] // Added: for project list scoring status checking
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

// Prisma型ベースの型安全なProject型をエクスポート
export type ProjectWithDetails = SerializedProject

// シリアライズされたQuestionScore型
export interface SerializedQuestionScore {
  id: string
  cropRegionId: string
  studentId: string | null
  partialScore: number | null
  status: string
  scoredByUserId: string | null
  createdAt: string
  updatedAt: string
}

// CropRegion型に適切なquestionScores型を追加
export interface SerializedCropRegion {
  id: string
  projectPageId: string
  label: string
  type: string
  x: number
  y: number
  width: number
  height: number
  orderIndex: number | null
  points: number | null
  createdAt: string
  updatedAt: string
  questionScores?: SerializedQuestionScore[]
}

// 型ガード関数群 - 型アサーションを使わない安全な型チェック
export function isValidProject(data: unknown): data is SerializedProject {
  if (typeof data !== 'object' || data === null) return false
  
  const obj = data as Record<string, unknown>
  
  return (
    typeof obj.id === 'string' &&
    typeof obj.examName === 'string' &&
    (obj.examDate === null || typeof obj.examDate === 'string') &&
    (obj.subject === undefined || obj.subject === null || typeof obj.subject === 'string') &&
    (obj.description === undefined || obj.description === null || typeof obj.description === 'string') &&
    typeof obj.createdAt === 'string' &&
    typeof obj.updatedAt === 'string' &&
    (obj.projectPages === undefined || Array.isArray(obj.projectPages)) &&
    (obj.cropRegions === undefined || Array.isArray(obj.cropRegions)) &&
    (obj.projectStudents === undefined || Array.isArray(obj.projectStudents)) &&
    (obj.userProjects === undefined || Array.isArray(obj.userProjects)) &&
    (obj.projectSubtotalGroups === undefined || Array.isArray(obj.projectSubtotalGroups)) &&
    (obj.answerImages === undefined || Array.isArray(obj.answerImages))
  )
}

export function isValidQuestionScore(data: unknown): data is SerializedQuestionScore {
  if (typeof data !== 'object' || data === null) return false
  
  const obj = data as Record<string, unknown>
  
  return (
    typeof obj.id === 'string' &&
    typeof obj.cropRegionId === 'string' &&
    (obj.studentId === null || typeof obj.studentId === 'string') &&
    (obj.partialScore === null || typeof obj.partialScore === 'number') &&
    typeof obj.status === 'string' &&
    (obj.scoredByUserId === null || typeof obj.scoredByUserId === 'string') &&
    typeof obj.createdAt === 'string' &&
    typeof obj.updatedAt === 'string'
  )
}

export function isValidCropRegion(data: unknown): data is SerializedCropRegion {
  if (typeof data !== 'object' || data === null) return false
  
  const obj = data as Record<string, unknown>
  
  return (
    typeof obj.id === 'string' &&
    typeof obj.projectPageId === 'string' &&
    typeof obj.label === 'string' &&
    typeof obj.type === 'string' &&
    typeof obj.x === 'number' &&
    typeof obj.y === 'number' &&
    typeof obj.width === 'number' &&
    typeof obj.height === 'number' &&
    (obj.orderIndex === null || typeof obj.orderIndex === 'number') &&
    (obj.points === null || typeof obj.points === 'number') &&
    typeof obj.createdAt === 'string' &&
    typeof obj.updatedAt === 'string' &&
    (obj.questionScores === undefined || 
      (Array.isArray(obj.questionScores) && 
       obj.questionScores.every(score => isValidQuestionScore(score))))
  )
}

export function isValidAnswerImage(data: unknown): data is NonNullable<SerializedProject['answerImages']>[number] {
  if (typeof data !== 'object' || data === null) return false
  
  const obj = data as Record<string, unknown>
  
  return (
    typeof obj.id === 'string' &&
    typeof obj.projectPageId === 'string' &&
    (obj.studentId === null || typeof obj.studentId === 'string') &&
    typeof obj.imagePath === 'string' &&
    typeof obj.imageType === 'string' &&
    typeof obj.pageNumber === 'number' &&
    typeof obj.createdAt === 'string' &&
    typeof obj.updatedAt === 'string' &&
    (obj.student === undefined || obj.student === null || typeof obj.student === 'object')
  )
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
  cropRegions?: any[] // Temporarily use any[] for database compatibility
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
