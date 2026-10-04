export type DemoStatus =
  "unscored" | "correct" | "incorrect" | "partial" | "no_answer" | "pending"

export interface GuideKeys {
  correct: string
  incorrect: string
  partial: string
  pending: string
  nextQuestion: string
  prevQuestion: string
  filterCorrect: string
  filterIncorrect: string
  toggleView: string
  toggleMaster: string
}

export interface NavKeys {
  up: string
  left: string
  down: string
  right: string
}

export interface ToolKeys {
  line: string
  rectangle: string
  ellipse: string
  text: string
  select: string
  hand: string
}

export interface DemoCell {
  name: string
  answer: string
  status: DemoStatus
  score?: number
}

export interface PartialInput {
  active: boolean
  value: string
}
