/**
 * 07-score-at-once 統合型定義
 * 複数の機能で使用される型をここに統一
 */

import type {
  ANSWER_SORT_ORDERS,
  LAYOUT_DIRECTIONS,
  MASTER_ANSWER_DISPLAY_MODES,
  MASTER_ANSWER_KEY_BEHAVIORS,
  SCORING_OPERATION_MODES,
} from "@/lib/userPreferences"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"
import type { QuestionScoreRow } from "@/queries/scoring"
/** Prisma拡張型をprismaExtensions.tsからインポート */
import type { StudentAnswerImageWithExamPageAndStudent } from "@/types/prismaExtensions"
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
  questionRegion: QuestionAnswerRegionRow
  /** ExamStudent.customOrder (必須・ソート用) */
  customOrder: number
}

/**
 * 採点操作モード
 * - "keyboard": キーボードモード（選択→キーで採点）
 * - "mouse": マウスモード（クリックで直接採点、選択概念なし）
 */
export type ScoringOperationMode = (typeof SCORING_OPERATION_MODES)[number]

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
  questionRegion: QuestionAnswerRegionRow
  customOrder: number
  isMaster: true
}

/**
 * その設問の採点行から、指定した利用者のものを1件取る。
 *
 * **その設問ぶんの配列を受け取る**（キャッシュがその単位で持っている）。試験ぜんぶを
 * 平らに渡されると `(examStudentId, cropRegionId)` の2つで探し直すことになるが、
 * 設問ぶんに絞られていれば照合は `examStudentId` と `userId` だけで済む。
 *
 * 07 が出すのは**自分の採点だけ**。他の教員の採点も同じ配列で届いているが、ここで
 * 落とす。食い違いを裁くのは採点する場ではない（8. 採点確定）。
 */
export function findQuestionScore(
  questionScores: readonly QuestionScoreRow[],
  examStudentId: string,
  userId: string
): QuestionScoreRow | undefined {
  const scores = questionScores.filter(
    (questionScore) =>
      questionScore.examStudentId === examStudentId &&
      questionScore.userId === userId
  )

  // 同期のマージで、同じ利用者の同じマスに2行残ることがある。`QuestionScore` に
  // `(examStudentId, cropRegionId, userId)` の unique がまだ無いためで、規約が禁じて
  // いるからではない（規約は「uuid 以外を unique にしない」で、この3列はすべて uuid
  // なので張ること自体は規約に反しない。張れば同期のマージが LWW で1行へ畳む）。
  // ただし `QuestionScore` は子（`DrawingAnnotation`）を持つため、いま張ると衝突時に
  // 勝った端末が外部キー違反で詰まり、その相手からの以後すべての変更が届かなくなる
  // （docs/sync-secondary-unique-hazard.md §3）。段階20 が入るまでは張れず、実際に
  // 張るかどうかは段階30 で判断する。
  // いま unique が無い以上ここは2行あることを前提に読む必要があり、
  // `find` で先頭を取ると2行目を黙って握り潰すため、最後に書かれた行を採る
  // （更新時刻 → id の順。集計側 scoreResolution.ts の pickLatest と同じ規則）。
  return scores.reduce<QuestionScoreRow | undefined>(
    (latest, questionScore) => {
      if (!latest) return questionScore
      const latestUpdatedAt = new Date(latest.updatedAt).getTime()
      const currentUpdatedAt = new Date(questionScore.updatedAt).getTime()
      if (currentUpdatedAt !== latestUpdatedAt) {
        return currentUpdatedAt > latestUpdatedAt ? questionScore : latest
      }
      return questionScore.id > latest.id ? questionScore : latest
    },
    undefined
  )
}

/** その設問における、指定した利用者の採点状況 */
export function getScoringStatus(
  questionScores: readonly QuestionScoreRow[] | undefined,
  examStudentId: string,
  userId: string
): ScoringStatus {
  if (!questionScores) return "unscored"

  const questionScore = findQuestionScore(questionScores, examStudentId, userId)
  return toScoringStatus(questionScore?.status)
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
