// Prisma型をインポート
import type {
  CropRegionWithExamPage,
  QuestionScore,
  ScoringData,
  StudentAnswerImageWithExamStudents,
} from "@/components/exams/07-score-at-once/types"

// 線種の型定義
export type LineStyle =
  | "solid"
  | "wave"
  | "zigzag"
  | "double"
  | "arrow"
  | "both_arrow"

// アンカー方向（8方向 + center）
export type AnchorDirection =
  | "top-left"
  | "top"
  | "top-right"
  | "left"
  | "center"
  | "right"
  | "bottom-left"
  | "bottom"
  | "bottom-right"

// 描画要素の型定義
export interface DrawingElement {
  id: string
  type: "text" | "line" | "vline" | "hline" | "rectangle" | "ellipse"
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
  anchorDirection?: AnchorDirection // テキストのアンカー方向
  // テキストボックス表示用座標（逆方向ドラッグ対応）
  displayX?: number // 0.0 - 1.0
  displayY?: number // 0.0 - 1.0
}

// 描画ツールの型定義
export type DrawingTool =
  | "hand"
  | "text"
  | "line"
  | "rectangle"
  | "ellipse"
  | "select"

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
  currentCropRegion?: CropRegionWithExamPage | null // 現在の設問領域
  cropRegions?: CropRegionWithExamPage[] // 全採点領域（全設問マーク描画用）

  // QuestionScore自動作成用のコンテキスト情報
  currentStudentId?: string
  currentUserId?: string

  // アノテーション用: QuestionScore配列（正しいquestionScoreIdを取得するため）
  questionScores?: QuestionScore[]

  // QuestionScore自動作成後のコールバック（リストの更新用）
  onQuestionScoreCreated?: () => void

  // Individual表示固有設定
  studentAnswerImages?: StudentAnswerImageWithExamStudents[] // 全答案データ
  showMultiplePages?: boolean // 複数画像の縦並び表示設定
  pageSpacing?: number // ページ間の余白（ピクセル）

  // アノテーション変更通知（キャンバス→ブラウザパネル連携用）
  onAnnotationChanged?: () => void
  // 外部からのアノテーション追加後のリフレッシュキー（ブラウザパネル→キャンバス連携用）
  annotationRefreshKey?: number

  // 模範解答表示（ズーム・スクロール同期のため内部で描画）
  /** 全ページの模範解答画像URL（ページ番号順） */
  masterOverlayImageUrls?: string[]
  masterOverlayOpacity?: number
  masterOverlayVisible?: boolean
  /** 模範解答表示モード（overlay のみ内部描画） */
  masterDisplayMode?: "overlay"
  /** zoom変更通知（split表示のMasterパネルと同期するため） */
  onZoomChanged?: (zoom: number) => void
  /** スクロールコンテナのRef公開（split表示のscroll同期用） */
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>
  /** 読み込み済み画像サイズ通知（split表示のMasterパネルで参照サイズとして使用） */
  onImageSizeChanged?: (size: { width: number; heights: number[] }) => void
  /** 模範解答の用紙サイズ（mm→px変換基準、デフォルト: "A4"） */
  pageSize?: string
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
  // テキスト再編集用
  isEditingExistingText: boolean
  editingTextElementId: string | null
  isShiftPressed: boolean
  isCtrlPressed: boolean // Ctrl/Cmd修飾キー状態
  isDraggingHandle: boolean
  currentHandle: string | null
  // ホバー中の要素ID（ハンドル表示用）
  hoveredElementId: string | null
}

// 描画アクション
export interface DrawingActions {
  setCurrentTool: (tool: DrawingTool) => void
  setStrokeColor: (color: string) => void
  setStrokeWidth: (width: number) => void
  setLineStyle: (style: LineStyle) => void
  setFontSize: (size: number) => void
  setDrawingElements: (
    elements: DrawingElement[] | ((prev: DrawingElement[]) => DrawingElement[])
  ) => void
  addDrawingElement: (element: DrawingElement) => void | Promise<void>
  updateDrawingElement: (
    id: string,
    updates: Partial<DrawingElement>
  ) => void | Promise<void>
  updateDrawingElements: (
    updates: Array<{ id: string; updates: Partial<DrawingElement> }>
  ) => void | Promise<void>
  removeDrawingElement: (id: string) => void | Promise<void>
  // 複数選択システム
  setSelectedElementIds: (ids: string[]) => void
  addToSelection: (id: string) => void
  removeFromSelection: (id: string) => void
  toggleSelection: (id: string) => void
  clearSelection: () => void
  // 選択範囲
  setIsDrawingSelection: (drawing: boolean) => void
  setSelectionRectangle: (
    rect:
      | SelectionRectangle
      | null
      | ((prev: SelectionRectangle | null) => SelectionRectangle | null)
  ) => void
  selectElementsInRectangle: (rect: SelectionRectangle) => void
  clearDrawing: () => void

  // Internal state updaters
  setIsDrawing: (drawing: boolean) => void
  setCurrentDrawing: (
    drawing:
      | Partial<DrawingElement>
      | null
      | ((
          prev: Partial<DrawingElement> | null
        ) => Partial<DrawingElement> | null)
  ) => void
  setIsDraggingElement: (dragging: boolean) => void
  setDragElementOffset: (offset: { x: number; y: number }) => void
  setLineEditMode: (mode: LineEditMode) => void
  setRectangleEditMode: (mode: RectangleEditMode) => void
  // テキスト再編集用
  setIsEditingExistingText: (editing: boolean) => void
  setEditingTextElementId: (id: string | null) => void
  setIsShiftPressed: (pressed: boolean) => void
  setIsCtrlPressed: (pressed: boolean) => void
  setIsDraggingHandle: (dragging: boolean) => void
  setCurrentHandle: (handle: string | null) => void
  // ホバー要素ID更新
  setHoveredElementId: (id: string | null) => void
}
