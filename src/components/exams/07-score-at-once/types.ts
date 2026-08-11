/**
 * 07-score-at-once 統合型定義
 * 複数の機能で使用される型をここに統一
 */

/** Prismaから基本型とPayload型をインポート */
import type { Prisma } from "@prisma/client"

import type {
  ANSWER_SORT_ORDERS,
  LAYOUT_DIRECTIONS,
  MASTER_ANSWER_DISPLAY_MODES,
  MASTER_ANSWER_KEY_BEHAVIORS,
} from "@/lib/userPreferences"
/** Prisma拡張型をprismaExtensions.tsからインポート */
import type {
  SerializedQuestionScore,
  StudentAnswerImageWithExamPageAndStudent,
} from "@/types/prismaExtensions"
import {
  type ScoringStatus,
  toScoringStatus,
} from "@/types/scoringStatus.types"

/**
 * StudentAnswerImageを学生とExamStudents情報で拡張した型
 * StudentAnswerImageWithExamPageAndStudentのエイリアス（型統一のため）
 * 変数名: studentAnswerImage, studentAnswerImages
 */
export type StudentAnswerImageWithExamStudents =
  StudentAnswerImageWithExamPageAndStudent

/**
 * CropRegionをExamPage情報で拡張したPrisma生成型
 * 変数名: cropRegion, cropRegions
 */
export type CropRegionWithExamPage = Prisma.CropRegionGetPayload<{
  include: {
    examPage: true
  }
}>

/**
 * 採点モード
 */
export type GradingMode = "grid" | "individual"

/**
 * レイアウト方向
 */
export type LayoutDirection = (typeof LAYOUT_DIRECTIONS)[number]

/**
 * 一覧表示の並び順
 * - "custom": 表示順（ExamStudent.customOrder）
 * - "whiteness": 白さ順（空欄に近い答案が先頭）
 * - "darkness": 濃さ順（記入の多い答案が先頭）
 *
 * 白さ順・濃さ順は一覧表示でのみ適用される。
 */
export type AnswerSortOrder = (typeof ANSWER_SORT_ORDERS)[number]

/**
 * 採点データの基本インターフェース
 * QuestionScore + Student + CropRegion + StudentAnswerImage の結合データから変換されたもの
 * 注意: 学生データのみを管理し、模範解答は別途管理する
 */
export interface ScoringData {
  /** StudentAnswerImage.id */
  id: string
  /** ExamStudent.id (UUID) */
  examStudentId: string
  /** 生徒氏名 */
  studentName: string
  /** 画像URL (appimg://...) */
  imageUrl: string
  /** QuestionScore.partialScore */
  currentScore?: number
  /** CropRegion.points */
  maxScore: number
  /** QuestionScore.status */
  status: ScoringStatus
  /** 採点領域情報 */
  questionRegion: CropRegionWithExamPage
  /** ExamStudent.customOrder (必須・ソート用) */
  customOrder: number
}

/**
 * 採点操作モード
 * - "keyboard": キーボードモード（選択→キーで採点）
 * - "mouse": マウスモード（クリックで直接採点、選択概念なし）
 */
export type ScoringOperationMode = "keyboard" | "mouse"

/**
 * マウスモード時のブラシ（シングルクリック時の動作）
 * - 採点ステータス: クリックで該当ステータスを適用
 * - "select": クリックで選択トグル（採点しない）
 * - "partial_modal": クリックで部分点入力モーダルを開く
 */
export type MouseBrushAction =
  Exclude<ScoringStatus, "unscored"> | "select" | "partial_modal"

/**
 * 模範解答表示モード
 */
export type MasterAnswerDisplayMode =
  (typeof MASTER_ANSWER_DISPLAY_MODES)[number]

/**
 * 模範解答キー動作モード
 */
export type MasterAnswerKeyBehavior =
  (typeof MASTER_ANSWER_KEY_BEHAVIORS)[number]

export type MasterStatus = "master"

export interface MasterGridItem {
  id: string
  examStudentId: "MASTER"
  studentName: string
  imageUrl: string
  maxScore: number
  status: MasterStatus
  questionRegion: CropRegionWithExamPage
  customOrder: number
  isMaster: true
}

/**
 * QuestionScore配列からの検索ユーティリティ関数
 * シンプルな線形検索でscoringDataオブジェクトを置き換え
 */
export function findQuestionScore(
  questionScores: SerializedQuestionScore[],
  examStudentId: string,
  cropRegionId: string
): SerializedQuestionScore | undefined {
  return questionScores.find(
    (score) =>
      score.examStudentId === examStudentId &&
      score.cropRegionId === cropRegionId
  )
}

/**
 * QuestionScore配列から採点状況を取得
 */
export function getScoringStatusFromArray(
  questionScores: SerializedQuestionScore[],
  examStudentId: string,
  cropRegionId?: string
): ScoringStatus {
  if (!cropRegionId) return "unscored"

  const score = findQuestionScore(questionScores, examStudentId, cropRegionId)
  return toScoringStatus(score?.status)
}

/**
 * ショートカット管理システムの型定義
 * 一括採点ページ専用のショートカット管理機能
 */

/**
 * 採点画面のコンテキスト状態
 * ショートカットの実行条件を判定するために使用される
 */
export interface ScoringContextState {
  /** input/textarea にフォーカスがある状態 */
  inputFocus: boolean

  /** リッチテキストエディタが開いている状態 */
  textEditorActive: boolean

  /** 現在の採点モード */
  gradingMode: GradingMode

  /** 何らかのモーダルが開いている状態 */
  modalOpen: boolean

  /** 部分点入力モーダルが開いている状態 */
  partialScoreModalOpen: boolean

  /** サイドパネルが表示されている状態 */
  sidePanelVisible: boolean

  /** 答案が選択されている状態 */
  hasSelectedAnswers: boolean

  /** 採点操作モード */
  scoringOperationMode: ScoringOperationMode
}

/**
 * コマンドハンドラーの定義
 */
export interface CommandHandler {
  /** コマンドID（例: "scoring.correct"） */
  commandId: string

  /** 各useCommand呼び出しを一意に識別するID */
  registrationId: string

  /** コマンド実行時のハンドラー関数 */
  handler: () => void

  /** 実行条件を表すwhen句（JavaScript式として評価される） */
  when: string

  /** コマンドのメタデータ（設定画面での表示用） */
  metadata?: CommandMetadata
}

/**
 * コマンドのメタデータ
 */
export interface CommandMetadata {
  /** コマンドのタイトル */
  title: string

  /** コマンドのカテゴリ（採点、ナビゲーション、フィルタなど） */
  category: string

  /** コマンドの説明（オプション） */
  description?: string
}

/**
 * キーバインディングの定義
 * commandId -> key のマッピング
 * 例: { "scoring.correct": "e", "navigation.nextQuestion": "Shift+d" }
 */
export interface KeyBinding {
  [commandId: string]: string
}

/**
 * ShortcutContextの値の型定義
 */
export interface ShortcutContextValue {
  /** 現在のコンテキスト状態 */
  context: ScoringContextState

  /** コンテキスト値を更新する関数 */
  setContextValue: <K extends keyof ScoringContextState>(
    key: K,
    value: ScoringContextState[K]
  ) => void

  /** コマンドを登録する関数 */
  registerCommand: (command: CommandHandler) => void

  /** コマンドを解除する関数 */
  unregisterCommand: (commandId: string, registrationId: string) => void

  /** 現在のキーバインディング */
  keyBindings: KeyBinding

  /** キーバインディングを更新する関数 */
  updateKeyBinding: (commandId: string, key: string) => void

  /** キーバインディングをデフォルトに戻す関数 */
  resetKeyBindings: () => void

  /** 登録されている全コマンドを取得する関数 */
  getAllCommands: () => CommandHandler[]
}
