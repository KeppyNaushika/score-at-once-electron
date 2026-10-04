/**
 * 描画ツールパレットに出すスタイルと、その変更
 * 種類（線・矩形・楕円・テキスト）ごとに、選択中の要素があればその値を出し、
 * 変更は選択中の同じ種類の要素と、次に描くときの既定値の両方へ入れる。
 */
import type {
  DrawingAnnotation,
  LineStyle,
} from "@/types/drawingAnnotation.types"

interface PaletteStylesParams {
  selectedElements: DrawingAnnotation[]
  /** 次に描くときの既定値 */
  strokeColor: string
  strokeWidth: number
  lineStyle: string
  onStrokeColorChange: (color: string) => void
  onStrokeWidthChange: (width: number) => void
  onLineStyleChange: (style: string) => void
  onUpdateSelectedElements?: (
    updates: Array<{ id: string; updates: Partial<DrawingAnnotation> }>
  ) => void
}

/**
 * 種類ごとの表示値と変更ハンドラ
 */
export function paletteStylesFor({
  selectedElements,
  strokeColor,
  strokeWidth,
  lineStyle,
  onStrokeColorChange,
  onStrokeWidthChange,
  onLineStyleChange,
  onUpdateSelectedElements,
}: PaletteStylesParams) {
  // 選択中の各タイプの要素を取得（複数選択対応）
  const selectedLines = selectedElements.filter(
    (element) => element.type === "line"
  )
  const selectedRectangles = selectedElements.filter(
    (element) => element.type === "rectangle"
  )
  const selectedEllipses = selectedElements.filter(
    (element) => element.type === "ellipse"
  )
  const selectedTexts = selectedElements.filter(
    (element) => element.type === "text"
  )

  // 代表要素（UI表示用に最初の要素を使用）
  const firstLine = selectedLines[0]
  const firstRectangle = selectedRectangles[0]
  const firstEllipse = selectedEllipses[0]
  const firstText = selectedTexts[0]

  /** 選択中の要素（同じ種類のもの）へ同じ変更を入れる */
  const updateElements = (
    elements: DrawingAnnotation[],
    updates: Partial<DrawingAnnotation>
  ) => {
    if (elements.length > 0 && onUpdateSelectedElements) {
      onUpdateSelectedElements(
        elements.map((element) => ({ id: element.id, updates }))
      )
    }
  }

  /** 色の変更（その種類の選択中の要素と既定値） */
  const colorChangeFor = (elements: DrawingAnnotation[]) => (color: string) => {
    updateElements(elements, { color })
    onStrokeColorChange(color)
  }

  /** 太さの変更（その種類の選択中の要素と既定値） */
  const widthChangeFor = (elements: DrawingAnnotation[]) => (width: number) => {
    updateElements(elements, { strokeWidth: width })
    onStrokeWidthChange(width)
  }

  return {
    selectedLines,
    selectedRectangles,
    selectedEllipses,
    selectedTexts,
    line: {
      // 選択中の線がある場合はその値を、なければデフォルト値を使用
      color: firstLine?.color || strokeColor,
      width: firstLine?.strokeWidth || strokeWidth,
      style: firstLine?.lineStyle || lineStyle,
      onColorChange: colorChangeFor(selectedLines),
      onWidthChange: widthChangeFor(selectedLines),
      onStyleChange: (style: string) => {
        updateElements(selectedLines, { lineStyle: style as LineStyle })
        onLineStyleChange(style)
      },
    },
    rectangle: {
      color: firstRectangle?.color || strokeColor,
      width: firstRectangle?.strokeWidth || strokeWidth,
      onColorChange: colorChangeFor(selectedRectangles),
      onWidthChange: widthChangeFor(selectedRectangles),
    },
    ellipse: {
      color: firstEllipse?.color || strokeColor,
      width: firstEllipse?.strokeWidth || strokeWidth,
      onColorChange: colorChangeFor(selectedEllipses),
      onWidthChange: widthChangeFor(selectedEllipses),
    },
    text: {
      color: firstText?.color || strokeColor,
      onColorChange: colorChangeFor(selectedTexts),
    },
  }
}
