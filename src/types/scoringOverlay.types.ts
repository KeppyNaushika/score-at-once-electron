/**
 * 答案画像に重ねて描く要素（採点マーク・設問の点数・小計・合計）の
 * 配置と見た目に関する型の単一の真実源(SSOT)。
 *
 * 採点画面（07）と結果出力（08）の双方が使うため機能内ではなくここに置く。
 * SQLite(Prisma) は enum 非対応なので、値の集合を保証できるのはこの union のみ。
 */
import type {
  ExamAnswerOverlayStyle,
  ExamAnswerOverlayVisibility,
} from "@prisma/client"

import type { ScoringStatus } from "./scoringStatus.types"
import { SCORING_STATUSES, toScoringStatus } from "./scoringStatus.types"
import { defineStringUnion } from "./stringUnion"

/**
 * 領域を3×3に分けた基準点。
 *
 * 「領域内のどこに置くか」（position）と「描画物のどの点をそこに合わせるか」（anchor）の
 * 双方に同じ9択を使う。
 */
export const OVERLAY_ANCHORS = [
  "top-left",
  "top-center",
  "top-right",
  "middle-left",
  "middle-center",
  "middle-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
] as const

export type OverlayAnchor = (typeof OVERLAY_ANCHORS)[number]

/** 想定外値は中央へ落とす */
const { to: toOverlayAnchor } = defineStringUnion(
  OVERLAY_ANCHORS,
  "middle-center"
)

/** 重ねて描く要素の種別 */
export const OVERLAY_KINDS = ["mark", "partial", "subtotal", "total"] as const

export type OverlayKind = (typeof OVERLAY_KINDS)[number]

/** 想定外値は採点マークへ落とす */
const { to: toOverlayKind } = defineStringUnion(OVERLAY_KINDS, "mark")

/** 基準点の日本語ラベル（設定UIの選択肢） */
export const OVERLAY_ANCHOR_LABELS: Record<OverlayAnchor, string> = {
  "top-left": "左上",
  "top-center": "上",
  "top-right": "右上",
  "middle-left": "左",
  "middle-center": "中央",
  "middle-right": "右",
  "bottom-left": "左下",
  "bottom-center": "下",
  "bottom-right": "右下",
}

// =============================================================================
// DB 行に型を注入した形（SQLite は enum 非対応のため文字列列を union へ絞る）
// =============================================================================

/** 重ね描き要素のスタイル1行 */
export type AnswerOverlayStyle = Omit<
  ExamAnswerOverlayStyle,
  "overlayKind" | "position" | "anchor"
> & {
  overlayKind: OverlayKind
  position: OverlayAnchor
  anchor: OverlayAnchor
}

/** 採点状態ごとの可視性1行 */
export type AnswerOverlayVisibility = Omit<
  ExamAnswerOverlayVisibility,
  "status"
> & {
  status: ScoringStatus
}

/**
 * 描画側が引くためにまとめた形。
 * DB は行で持ち、種別・状態で O(1) 参照したい描画側だけがこの形へ組み直す。
 */
export interface AnswerOverlaySettings {
  styles: Record<OverlayKind, AnswerOverlayStyle>
  visibility: Record<ScoringStatus, AnswerOverlayVisibility>
}

/** DB 行を描画側の形へ組む。欠けている種別・状態は既定値で補う */
export function toAnswerOverlaySettings(
  styleRows: ExamAnswerOverlayStyle[],
  visibilityRows: ExamAnswerOverlayVisibility[],
  defaults: AnswerOverlaySettings
): AnswerOverlaySettings {
  const styles = { ...defaults.styles }
  for (const styleRow of styleRows) {
    styles[toOverlayKind(styleRow.overlayKind)] = {
      ...styleRow,
      overlayKind: toOverlayKind(styleRow.overlayKind),
      position: toOverlayAnchor(styleRow.position),
      anchor: toOverlayAnchor(styleRow.anchor),
    }
  }

  const visibility = { ...defaults.visibility }
  for (const visibilityRow of visibilityRows) {
    visibility[toScoringStatus(visibilityRow.status)] = {
      ...visibilityRow,
      status: toScoringStatus(visibilityRow.status),
    }
  }

  return { styles, visibility }
}

// =============================================================================
// 既定値（main / renderer の双方が参照する）
// =============================================================================

/** 既定色 */
const DEFAULT_MARK_COLOR = "#ef4444" // 採点記号マーク（赤）
const DEFAULT_PARTIAL_SCORE_COLOR = "#ef4444" // 設問の点数（赤）
const DEFAULT_SUBTOTAL_SCORE_COLOR = "#2563eb" // 小計（青）
const DEFAULT_TOTAL_SCORE_COLOR = "#16a34a" // 合計（緑）

/** カラーパレット（一括採点アノテーションと同じ基本色） */
export const OVERLAY_COLOR_PRESETS = [
  "#000000", // 黒
  "#ef4444", // 赤
  "#ff8000", // オレンジ
  "#ffd700", // 金
  "#16a34a", // 緑
  "#00bcd4", // シアン
  "#2563eb", // 青
  "#8000ff", // 紫
] as const

const buildDefaultStyle = (
  overlayKind: OverlayKind,
  size: number,
  color: string
): AnswerOverlayStyle => ({
  id: `default:${overlayKind}`,
  examId: "",
  overlayKind,
  position: "middle-center",
  anchor: "middle-center",
  offsetX: 0,
  offsetY: 0,
  size,
  color,
  opacity: 100,
  createdAt: new Date(0),
  updatedAt: new Date(0),
})

/** 採点状態ごとの既定可視性（未採点だけ描かない） */
const buildDefaultVisibility = (
  status: ScoringStatus
): AnswerOverlayVisibility => ({
  id: `default:${status}`,
  examId: "",
  status,
  showMark: status !== "unscored",
  showScore: status !== "unscored",
  createdAt: new Date(0),
  updatedAt: new Date(0),
})

/** 設定が未保存の試験に使う既定値 */
export const DEFAULT_ANSWER_OVERLAY_SETTINGS: AnswerOverlaySettings = {
  styles: {
    mark: buildDefaultStyle("mark", 50, DEFAULT_MARK_COLOR),
    partial: buildDefaultStyle("partial", 14, DEFAULT_PARTIAL_SCORE_COLOR),
    subtotal: buildDefaultStyle("subtotal", 18, DEFAULT_SUBTOTAL_SCORE_COLOR),
    total: buildDefaultStyle("total", 18, DEFAULT_TOTAL_SCORE_COLOR),
  },
  visibility: Object.fromEntries(
    SCORING_STATUSES.map((status) => [status, buildDefaultVisibility(status)])
  ) as Record<ScoringStatus, AnswerOverlayVisibility>,
}
