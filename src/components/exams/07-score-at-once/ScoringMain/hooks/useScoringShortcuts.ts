/**
 * 採点画面のキーボードショートカット定義フック
 *
 * ScoringMainViewから抽出されたショートカット登録ロジック
 * 効く場面から when 句を導く useSceneCommand で登録する
 */

import type { ScoringStatus } from "@/types/scoringStatus.types"

import { usePartialScoreShortcuts } from "./shortcuts/usePartialScoreShortcuts"
import { useScoringCommandShortcuts } from "./shortcuts/useScoringCommandShortcuts"
import { useViewNavigationShortcuts } from "./shortcuts/useViewNavigationShortcuts"

/**
 * ショートカットハンドラーの型定義
 */
export interface ScoringShortcutHandlers {
  /** 生徒名表示切り替え */
  handleToggleStudentNames: () => void
  /** フィルタ更新 */
  handleRefreshFilter: () => void
  /** 次の設問 */
  handleNextQuestion: () => void
  /** 前の設問 */
  handlePrevQuestion: () => void
  /** グリッドナビゲーション */
  handleGridNavigation: (key: string) => void
  /** 個別モードナビゲーション（レイアウト方向に応じた次/前の生徒移動） */
  handleIndividualNavigation: (key: string) => void
  /** ズームイン */
  handleZoomIn: () => void
  /** ズームアウト */
  handleZoomOut: () => void
  /** ズームリセット */
  handleResetZoom: () => void
  /** 部分点入力開始 */
  handlePartialScoreInput: (key: string) => void
  /** 部分点確定（部分点として） */
  handlePartialScoreConfirmPartial: () => void
  /** 部分点確定（保留として） */
  handlePartialScoreConfirmPending: () => void
  /** 部分点入力キャンセル */
  handlePartialScoreCancel: () => void
  /** 部分点入力バックスペース */
  handlePartialScoreBackspace: () => void
  /** 採点実行（サイドパネル非表示でも有効にするため） */
  handleScore: (status: ScoringStatus) => void
  /** フィルタトグル（サイドパネル非表示でも有効にするため） */
  handleToggleFilter: (key: string) => void
  /** 全選択（表示中の答案をすべて選択） */
  handleSelectAll: () => void
  /** 表示モード切り替え（グリッド⇔個別） */
  handleToggleViewMode: () => void
  /** 模範解答表示トグル（個別モード） */
  handleToggleMasterAnswer?: () => void
}

/**
 * 採点画面のショートカットを登録するフック
 *
 * @param handlers - 各ショートカットに対応するハンドラー関数
 */
export function useScoringShortcuts(handlers: ScoringShortcutHandlers): void {
  useScoringCommandShortcuts(handlers)
  useViewNavigationShortcuts(handlers)
  usePartialScoreShortcuts(handlers)
}
