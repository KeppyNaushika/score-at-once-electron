/**
 * レイアウト計算の途中で受け渡す型。
 *
 * 単一ページ（`computeLayout.ts`）と複数ページ（`computeMultiPageLayout.ts`）が
 * 大問の配置と番号列の罫線を共有するので、その書き込み先と集める区間をここに置く。
 */

import type {
  GlobalSettings,
  MajorQuestion,
} from "@/types/answerSheetDefinition.types"
import type {
  ComputedCell,
  ComputedLine,
  ComputedNumberLabel,
} from "@/types/answerSheetLayout.types"

/** Y 区間ごとの右端（外枠をステップ形状にするのに使う） */
export interface RowRightEdge {
  yTop: number
  yBottom: number
  rightX: number
}

/** Y 区間ごとの左端（外枠をステップ形状にするのに使う） */
export interface RowLeftEdge {
  yTop: number
  yBottom: number
  leftX: number
}

/** 番号列の縦線を引く Y 区間 */
export interface VerticalRange {
  top: number
  bottom: number
}

/** 枝問番号列の縦線を引く Y 区間（枝問ごとに X が違う） */
interface BranchVerticalRange extends VerticalRange {
  lineX: number
}

/** 大問1つが占めた範囲と、その中の行の端 */
export interface MajorLayoutRange {
  startY: number
  endY: number
  rowRightEdges: RowRightEdge[]
  rowLeftEdges: RowLeftEdge[]
}

/** 段（単一ページでは用紙全体）の座標範囲 */
export interface ColumnBounds {
  contentLeft: number
  contentRight: number
  majorNumX: number
  subNumX: number
}

/** 描いたものの書き込み先（ページ単位） */
export interface LayoutPageSink {
  cells: ComputedCell[]
  lines: ComputedLine[]
  numberLabels: ComputedNumberLabel[]
}

/** 段ごとに集める行の端と番号列の区間（ページの罫線を最後に引くのに使う） */
export interface LayoutColumnSink {
  rowRightEdges: RowRightEdge[]
  rowLeftEdges: RowLeftEdge[]
  /** 小問番号列の縦線を引く区間（ラベルのある縦配置の小問だけ） */
  verticalRanges: VerticalRange[]
  /** 枝問番号列の縦線を引く区間（ラベルのある縦配置の枝問だけ） */
  branchVerticalRanges: BranchVerticalRange[]
  /** 横配置（グリッド）の大問の区間。大問番号列の縦線をここで切る */
  horizontalMajorRanges: VerticalRange[]
}

/** 大問の配置で変わらない値（用紙設定と列幅） */
export interface MajorLayoutContext {
  settings: GlobalSettings
  paper: { width: number; height: number }
  majorNumWidth: number
  subNumWidth: number
  branchNumWidth: number
  /**
   * 罫線にドラッグの手掛かり（`dragInfo`）を付けるか。
   * 罫線をつまんで寸法を変えられるのは単一ページのプレビューだけ。
   */
  withDragInfo: boolean
}

/** 大問1つを置く場所 */
export interface MajorPlacement {
  major: MajorQuestion
  majorIndex: number
  /** 大問の上端 */
  startY: number
  pageIndex: number
  bounds: ColumnBounds
  /** 小問を並べる領域の左端（大問番号列の右） */
  horizontalAreaX: number
  horizontalAreaWidth: number
}
