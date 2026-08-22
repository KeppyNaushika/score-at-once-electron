import type {
  ScoringData,
  StudentAnswerImageWithExamStudents,
} from "@/components/exams/07-score-at-once/types"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"
import type {
  DrawingAnnotation,
  LineStyle,
} from "@/types/drawingAnnotation.types"

// Canvas が持つのは DrawingAnnotation の行そのもの（DB に保存されている形）。
// 座標 x/y と width/height/endX/endY は 0.0-1.0 の割合、strokeWidth/fontSize は mm。

// 描画ツールの型定義
export type CanvasTool =
  "hand" | "text" | "line" | "rectangle" | "ellipse" | "select"

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
  currentCropRegion?: QuestionAnswerRegionRow | null // 現在の設問領域
  cropRegions?: QuestionAnswerRegionRow[] // 全採点領域（全設問マーク描画用）

  // 手書き注釈の行き先（答案＋設問＋採点者）を組み立てるための文脈
  currentExamStudentId?: string
  currentUserId: string

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
  currentTool: CanvasTool
  strokeColor: string
  strokeWidth: number
  lineStyle: LineStyle
  fontSize: number
  drawingElements: DrawingAnnotation[]
  isDrawing: boolean
  currentDrawing: Partial<DrawingAnnotation> | null
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
  setCurrentTool: (tool: CanvasTool) => void
  setStrokeColor: (color: string) => void
  setStrokeWidth: (width: number) => void
  setLineStyle: (style: LineStyle) => void
  setFontSize: (size: number) => void
  setDrawingElements: (
    elements:
      DrawingAnnotation[] | ((prev: DrawingAnnotation[]) => DrawingAnnotation[])
  ) => void
  addDrawingElement: (element: DrawingAnnotation) => void | Promise<void>
  updateDrawingElement: (
    id: string,
    updates: Partial<DrawingAnnotation>
  ) => void | Promise<void>
  updateDrawingElements: (
    updates: Array<{ id: string; updates: Partial<DrawingAnnotation> }>
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
      | Partial<DrawingAnnotation>
      | null
      | ((
          prev: Partial<DrawingAnnotation> | null
        ) => Partial<DrawingAnnotation> | null)
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
