"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

interface ColorPickerProps {
  /** 現在の色（HEX形式） */
  value: string
  /** 色が変更された時のコールバック */
  onChange: (color: string) => void
  /** プリセット色の配列 */
  presets?: string[]
  /** 無効状態 */
  disabled?: boolean
  /** カスタムクラス名 */
  className?: string
}

/**
 * カラーピッカーコンポーネント
 *
 * - HEX形式の色を選択・入力可能
 * - プリセット色から選択可能
 * - ネイティブカラーピッカーと連携
 */
export function ColorPicker({
  value,
  onChange,
  presets = [],
  disabled = false,
  className,
}: ColorPickerProps) {
  const [open, setOpen] = React.useState(false)
  const [inputValue, setInputValue] = React.useState(value)

  // 外部からのvalue変更を反映
  React.useEffect(() => {
    setInputValue(value)
  }, [value])

  // HEX形式のバリデーション
  const isValidHex = (hex: string): boolean => {
    return /^#[0-9A-Fa-f]{6}$/.test(hex)
  }

  // 入力値の変更処理
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let newValue = e.target.value
    // #がなければ追加
    if (!newValue.startsWith("#")) {
      newValue = "#" + newValue
    }
    setInputValue(newValue)

    // 有効なHEX形式なら親に通知
    if (isValidHex(newValue)) {
      onChange(newValue)
    }
  }

  // ネイティブカラーピッカーからの変更
  const handleNativeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newColor = e.target.value.toUpperCase()
    setInputValue(newColor)
    onChange(newColor)
  }

  // プリセット選択
  const handlePresetClick = (color: string) => {
    setInputValue(color)
    onChange(color)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <Button
          variant="outline"
          className={cn(
            "h-9 w-9 border-2 p-0",
            disabled && "cursor-not-allowed opacity-50",
            className
          )}
          style={{ backgroundColor: value }}
          aria-label="色を選択"
        >
          <span className="sr-only">色を選択</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64" align="start">
        <div className="space-y-3">
          {/* カラーピッカーとHEX入力 */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <input
                type="color"
                value={value}
                onChange={handleNativeChange}
                className="h-9 w-9 cursor-pointer rounded border-0 p-0"
                style={{ backgroundColor: value }}
              />
            </div>
            <Input
              value={inputValue}
              onChange={handleInputChange}
              placeholder="#000000"
              className="flex-1 font-mono text-sm"
              maxLength={7}
            />
          </div>

          {/* プリセット色 */}
          {presets.length > 0 && (
            <div>
              <p className="mb-2 text-xs text-muted-foreground">プリセット</p>
              <div className="flex flex-wrap gap-1">
                {presets.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => handlePresetClick(color)}
                    className={cn(
                      "h-6 w-6 rounded border-2 transition-transform hover:scale-110",
                      value === color
                        ? "border-gray-800 ring-2 ring-gray-400"
                        : "border-gray-300"
                    )}
                    style={{ backgroundColor: color }}
                    aria-label={`色 ${color}`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

/**
 * インラインカラーピッカー（プリセット + カスタム選択）
 *
 * 設定画面での使用を想定した、プリセットとカスタム色を
 * 横並びで表示するコンポーネント
 */
interface InlineColorPickerProps {
  /** 現在の色（HEX形式） */
  value: string
  /** 色が変更された時のコールバック */
  onChange: (color: string) => void
  /** プリセット色の配列 */
  presets: string[]
  /** 無効状態 */
  disabled?: boolean
}

export function InlineColorPicker({
  value,
  onChange,
  presets,
  disabled = false,
}: InlineColorPickerProps) {
  const isPresetColor = presets.includes(value)

  return (
    <div className="flex items-center gap-2">
      {/* プリセット色 */}
      {presets.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => !disabled && onChange(color)}
          disabled={disabled}
          className={cn(
            "h-8 w-8 rounded-lg border-2 transition-all",
            value === color
              ? "scale-110 border-gray-800 shadow-md"
              : "border-gray-200 hover:scale-105 hover:border-gray-300",
            disabled && "cursor-not-allowed opacity-50"
          )}
          style={{ backgroundColor: color }}
          aria-label={`色 ${color}`}
        />
      ))}

      {/* カスタム色ピッカー */}
      <ColorPicker
        value={isPresetColor ? "#808080" : value}
        onChange={onChange}
        disabled={disabled}
        className={cn(!isPresetColor && "ring-2 ring-gray-400")}
      />
    </div>
  )
}
