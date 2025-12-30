/**
 * @fileoverview 描画ツールバーコンポーネント
 * @description 統合描画システム用のツールバー（ツール選択・設定）
 */

'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  MousePointer,
  Type,
  Minus,
  Square,
  Circle,
  Trash2,
  RotateCcw
} from 'lucide-react'

import type { DrawingTool } from '@/hooks/useDrawingAnnotations'
import type { LineStyle } from '@/types/drawing-annotation.types'

/**
 * ツールバーのプロパティ
 */
export interface DrawingToolbarProps {
  /** 現在選択中のツール */
  currentTool: DrawingTool
  /** ツール変更コールバック */
  onToolChange: (tool: DrawingTool) => void
  /** 描画色 */
  drawingColor: string
  /** 色変更コールバック */
  onColorChange: (color: string) => void
  /** 線の太さ */
  strokeWidth: number
  /** 線の太さ変更コールバック */
  onStrokeWidthChange: (width: number) => void
  /** 線のスタイル */
  lineStyle: LineStyle
  /** 線のスタイル変更コールバック */
  onLineStyleChange: (style: LineStyle) => void
  /** フォントサイズ */
  fontSize: number
  /** フォントサイズ変更コールバック */
  onFontSizeChange: (size: number) => void
  /** 選択中のアノテーションID */
  selectedAnnotationId: string | null
  /** 削除コールバック */
  onDelete?: () => void
  /** 全削除コールバック */
  onClearAll?: () => void
  /** 読み取り専用モード */
  readOnly?: boolean
  /** クラス名 */
  className?: string
}

/**
 * 描画ツールの定義
 */
const DRAWING_TOOLS = [
  { id: 'select', label: '選択', icon: MousePointer },
  { id: 'text', label: 'テキスト', icon: Type },
  { id: 'line', label: '直線', icon: Minus },
  { id: 'rectangle', label: '長方形', icon: Square },
  { id: 'ellipse', label: '楕円', icon: Circle },
] as const

/**
 * 線のスタイルの定義
 */
const LINE_STYLES: { value: LineStyle; label: string }[] = [
  { value: 'solid', label: '実線' },
  { value: 'wave', label: '波線' },
  { value: 'zigzag', label: 'ジグザグ' },
  { value: 'double', label: '二重線' },
  { value: 'arrow', label: '矢印' },
  { value: 'both_arrow', label: '両矢印' },
]

/**
 * プリセット色
 */
const PRESET_COLORS = [
  '#ef4444', // red-500
  '#f97316', // orange-500
  '#eab308', // yellow-500
  '#22c55e', // green-500
  '#3b82f6', // blue-500
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
  '#000000', // black
  '#6b7280', // gray-500
]

/**
 * 描画ツールバーコンポーネント
 */
export const DrawingToolbar: React.FC<DrawingToolbarProps> = ({
  currentTool,
  onToolChange,
  drawingColor,
  onColorChange,
  strokeWidth,
  onStrokeWidthChange,
  lineStyle,
  onLineStyleChange,
  fontSize,
  onFontSizeChange,
  selectedAnnotationId,
  onDelete,
  onClearAll,
  readOnly = false,
  className = ''
}) => {
  return (
    <div className={`flex items-center gap-2 p-3 bg-white border rounded-lg shadow-sm ${className}`}>
      {/* ツール選択 */}
      <div className="flex items-center gap-1">
        {DRAWING_TOOLS.map(({ id, label, icon: Icon }) => (
          <Button
            key={id}
            variant={currentTool === id ? 'default' : 'outline'}
            size="sm"
            onClick={() => onToolChange(id as DrawingTool)}
            disabled={readOnly}
            title={label}
            className="w-8 h-8 p-0"
          >
            <Icon className="w-4 h-4" />
          </Button>
        ))}
      </div>

      <Separator orientation="vertical" className="h-8" />

      {/* 色選択 */}
      <div className="flex items-center gap-2">
        <Label htmlFor="color" className="text-sm font-medium">
          色:
        </Label>
        <div className="flex items-center gap-1">
          {/* プリセット色 */}
          {PRESET_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              className={`w-6 h-6 rounded border-2 ${
                drawingColor === color
                  ? 'border-gray-900 ring-2 ring-gray-400'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
              style={{ backgroundColor: color }}
              onClick={() => onColorChange(color)}
              disabled={readOnly}
              title={color}
            />
          ))}
          {/* カスタム色選択 */}
          <input
            id="color"
            type="color"
            value={drawingColor}
            onChange={(e) => onColorChange(e.target.value)}
            disabled={readOnly}
            className="w-8 h-6 rounded border border-gray-300 cursor-pointer disabled:cursor-not-allowed"
          />
        </div>
      </div>

      <Separator orientation="vertical" className="h-8" />

      {/* 線の太さ */}
      <div className="flex items-center gap-2">
        <Label htmlFor="strokeWidth" className="text-sm font-medium whitespace-nowrap">
          太さ:
        </Label>
        <Input
          id="strokeWidth"
          type="number"
          min="1"
          max="20"
          value={strokeWidth}
          onChange={(e) => onStrokeWidthChange(Number(e.target.value))}
          disabled={readOnly}
          className="w-16 h-8"
        />
      </div>

      {/* 線のスタイル（直線ツール選択時のみ表示） */}
      {currentTool === 'line' && (
        <>
          <Separator orientation="vertical" className="h-8" />
          <div className="flex items-center gap-2">
            <Label htmlFor="lineStyle" className="text-sm font-medium whitespace-nowrap">
              線種:
            </Label>
            <Select
              value={lineStyle}
              onValueChange={(value) => onLineStyleChange(value as LineStyle)}
              disabled={readOnly}
            >
              <SelectTrigger className="w-24 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LINE_STYLES.map(({ value, label }) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </>
      )}

      {/* フォントサイズ（テキストツール選択時のみ表示） */}
      {currentTool === 'text' && (
        <>
          <Separator orientation="vertical" className="h-8" />
          <div className="flex items-center gap-2">
            <Label htmlFor="fontSize" className="text-sm font-medium whitespace-nowrap">
              文字:
            </Label>
            <Input
              id="fontSize"
              type="number"
              min="8"
              max="72"
              value={fontSize}
              onChange={(e) => onFontSizeChange(Number(e.target.value))}
              disabled={readOnly}
              className="w-16 h-8"
            />
          </div>
        </>
      )}

      <Separator orientation="vertical" className="h-8" />

      {/* アクション */}
      <div className="flex items-center gap-1">
        {/* 選択中アイテム削除 */}
        <Button
          variant="outline"
          size="sm"
          onClick={onDelete}
          disabled={readOnly || !selectedAnnotationId}
          title="選択中の要素を削除"
          className="w-8 h-8 p-0"
        >
          <Trash2 className="w-4 h-4" />
        </Button>

        {/* 全削除 */}
        <Button
          variant="outline"
          size="sm"
          onClick={onClearAll}
          disabled={readOnly}
          title="すべての描画を削除"
          className="w-8 h-8 p-0"
        >
          <RotateCcw className="w-4 h-4" />
        </Button>
      </div>

      {/* 現在の状態表示 */}
      <div className="ml-auto flex items-center gap-2 text-sm text-gray-500">
        {readOnly && (
          <span className="px-2 py-1 bg-gray-100 rounded text-xs">
            読み取り専用
          </span>
        )}
        {selectedAnnotationId && (
          <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
            要素選択中
          </span>
        )}
      </div>
    </div>
  )
}

export default DrawingToolbar