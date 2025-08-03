// Prisma型をインポート
import type { ScoringData } from "@/components/projects/07-score-at-once/types"
import type {
  CropRegionWithProjectPage,
  PageImageWithProjectStudents,
  ScoringStatus,
} from "@/components/projects/07-score-at-once/types"

// 線種の型定義
export type LineStyle = "solid" | "wave" | "zigzag" | "double"

// 描画要素の型定義
export interface DrawingElement {
  id: string
  type: "text" | "line" | "vline" | "hline" | "rectangle"
  x: number // 0.0 - 1.0 (画像全体に対する割合)
  y: number // 0.0 - 1.0
  width?: number // 0.0 - 1.0
  height?: number // 0.0 - 1.0
  endX?: number // 0.0 - 1.0
  endY?: number // 0.0 - 1.0
  text?: string
  color: string
  strokeWidth: number
  lineStyle?: LineStyle
  fontSize?: number
  // テキストボックス用
  textBoxWidth?: number // 0.0 - 1.0
  textBoxHeight?: number // 0.0 - 1.0
}

// 描画ツールの型定義
export type DrawingTool = "hand" | "text" | "line" | "rectangle" | "select"

// 線の編集モード
export type LineEditMode = "move" | "start" | "end" | null

// 矩形の編集モード
export type RectangleEditMode = "move" | "resize" | null

// AnswerIndividualViewのプロパティ（画像操作関連は内部管理）
export interface AnswerIndividualViewProps {
  // Individual表示専用データ引数（単一データの詳細表示）
  scoringDatas: ScoringData[] // 全データ（生徒選択のため）
  currentScoringDataId: string | null // 現在表示中のデータID（selectedの最初の要素）

  // 設問情報（派生済みオブジェクト）
  currentCropRegion?: CropRegionWithProjectPage | null // 現在の設問領域

  // 操作関数
  onScoringDataScore?: (
    statusOrAnswerIds: string | string[],
    statusOrPartialScore?: ScoringStatus | number,
    partialScore?: number,
  ) => void

  // Individual表示固有設定
  pageImages?: PageImageWithProjectStudents[] // 全答案データ
  showMultiplePages?: boolean // 複数画像の縦並び表示設定
  pageSpacing?: number // ページ間の余白（ピクセル）
}

// 選択範囲矩形の型定義
export interface SelectionRectangle {
  x: number // 0.0 - 1.0 (画像全体に対する割合)
  y: number // 0.0 - 1.0
  width: number // 0.0 - 1.0
  height: number // 0.0 - 1.0
}

// 描画状態管理用のインターフェース
export interface DrawingState {
  currentTool: DrawingTool
  strokeColor: string
  strokeWidth: number
  lineStyle: LineStyle
  fontSize: number
  drawingElements: DrawingElement[]
  isDrawing: boolean
  currentDrawing: Partial<DrawingElement> | null
  // 複数選択システム
  selectedElementIds: string[] // 選択された要素IDの配列
  isDraggingElement: boolean
  dragElementOffset: { x: number; y: number }
  // 選択範囲ドラッグ
  isDrawingSelection: boolean // 選択範囲を描画中かどうか
  selectionRectangle: SelectionRectangle | null // 選択範囲矩形
  // その他の状態
  lineEditMode: LineEditMode
  rectangleEditMode: RectangleEditMode
  isCreatingTextBox: boolean
  showTextInput: boolean
  textInputPosition: { x: number; y: number }
  textInputValue: string
  isShiftPressed: boolean
  isCtrlPressed: boolean // Ctrl/Cmd修飾キー状態
  isDraggingHandle: boolean
  currentHandle: string | null
}

// 描画アクション
export interface DrawingActions {
  setCurrentTool: (tool: DrawingTool) => void
  setStrokeColor: (color: string) => void
  setStrokeWidth: (width: number) => void
  setLineStyle: (style: LineStyle) => void
  setFontSize: (size: number) => void
  setDrawingElements: (elements: DrawingElement[]) => void
  addDrawingElement: (element: DrawingElement) => void
  updateDrawingElement: (id: string, updates: Partial<DrawingElement>) => void
  removeDrawingElement: (id: string) => void
  // 複数選択システム
  setSelectedElementIds: (ids: string[]) => void
  addToSelection: (id: string) => void
  removeFromSelection: (id: string) => void
  toggleSelection: (id: string) => void
  clearSelection: () => void
  // 選択範囲
  setIsDrawingSelection: (drawing: boolean) => void
  setSelectionRectangle: (rect: SelectionRectangle | null) => void
  selectElementsInRectangle: (rect: SelectionRectangle) => void
  clearDrawing: () => void

  // Internal state updaters
  setIsDrawing: (drawing: boolean) => void
  setCurrentDrawing: (drawing: Partial<DrawingElement> | null) => void
  setIsDraggingElement: (dragging: boolean) => void
  setDragElementOffset: (offset: { x: number; y: number }) => void
  setLineEditMode: (mode: LineEditMode) => void
  setRectangleEditMode: (mode: RectangleEditMode) => void
  setIsCreatingTextBox: (creating: boolean) => void
  setShowTextInput: (show: boolean) => void
  setTextInputPosition: (position: { x: number; y: number }) => void
  setTextInputValue: (value: string) => void
  setIsShiftPressed: (pressed: boolean) => void
  setIsCtrlPressed: (pressed: boolean) => void
  setIsDraggingHandle: (dragging: boolean) => void
  setCurrentHandle: (handle: string | null) => void
}
