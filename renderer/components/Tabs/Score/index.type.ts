export type Id = string
export type ExamId = Id
export type SheetId = Id
export type QuestionId = Id
export type StudentId = Id

export interface CropCoords {
  top: number
  bottom: number
  left: number
  right: number
}

export interface Tag {
  name: string
  isEnabled: boolean
}

export interface Question {
  tags: [Tag[]]
  examId: ExamId
  questionId: QuestionId
  sheetId: SheetId
  crop: CropCoords
}

export interface Order {
  id: number
  className: string
  isSelected: boolean
}

export const SCORES = [
  "unscored",
  "correct",
  "partial",
  "pending",
  "incorrect",
  "noanswer",
] as const

export const SHOWS = SCORES.map((score) => `toggle-show-${score}` as const)

export const PARTIALPOINTS = (
  ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "backspace"] as const
).map((v) => `partial-point-${v}` as const)

export type Score = (typeof SCORES)[number]

export type Show = (typeof SHOWS)[number]

export type PartialPoint = (typeof PARTIALPOINTS)[number]

export const dragActions = [
  "newAnswerArea",
  "addAnswerArea",
  "dragAnswerArea",
] as const
export type DragAction = (typeof dragActions)[number]
