// 答案表示の型定義
export interface StudentAnswer {
  id: string
  studentId: string
  imagePath: string
  pageNumber: number
  student: {
    id: string
    studentId: string
    lastName: string
    firstName: string
  }
}

// 設問領域の型定義
export interface QuestionRegion {
  id: string
  label: string
  orderIndex?: number
  points: number
  x: number // 0.0 - 1.0 (画像全体に対する割合)
  y: number // 0.0 - 1.0
  width: number // 0.0 - 1.0
  height: number // 0.0 - 1.0
  projectPageId: string // ProjectPageとの関連付け
  projectPage?: {
    pageNumber: number
  }
}

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
  answerSheet: StudentAnswer
  currentQuestion?: QuestionRegion
  // 全答案データ（既存のデータから適切な画像を検索するため）
  allAnswerSheets?: StudentAnswer[]
  // 複数画像の縦並び表示設定
  showMultiplePages?: boolean
  pageSpacing?: number // ページ間の余白（ピクセル）
  // 採点機能統合
  selectedAnswers?: Set<string>
  onAnswerScore?: (
    statusOrAnswerIds: any,
    statusOrPartialScore?: any,
    partialScore?: any,
  ) => void
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
  selectedElementId: string | null
  isDraggingElement: boolean
  dragElementOffset: { x: number; y: number }
  lineEditMode: LineEditMode
  rectangleEditMode: RectangleEditMode
  isCreatingTextBox: boolean
  showTextInput: boolean
  textInputPosition: { x: number; y: number }
  textInputValue: string
  isShiftPressed: boolean
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
  setSelectedElementId: (id: string | null) => void
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
}