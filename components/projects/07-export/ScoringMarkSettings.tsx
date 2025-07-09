"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Settings, AlignLeft, AlignCenter, AlignRight, FileText, RotateCcw } from "lucide-react"
import { useState, useEffect } from "react"

// 採点状態の型定義
export type ScoringStatus = 
  | "unscored"      // 未採点
  | "correct"       // 正答
  | "partial"       // 部分点
  | "hold"          // 保留
  | "incorrect"     // 誤答
  | "no_answer"     // 無答

// 位置の型定義
export type MarkPosition = 
  | "top-left"      // 左上
  | "top-center"    // 上
  | "top-right"     // 右上
  | "middle-left"   // 左
  | "middle-center" // 中央
  | "middle-right"  // 右
  | "bottom-left"   // 左下
  | "bottom-center" // 下
  | "bottom-right"  // 右下

// テキスト配置の型定義
export type TextAlignment = "left" | "center" | "right"

// PDF設定の型定義
export type PageSize = "A4" | "A3" | "B4" | "B5" | "Letter"
export type PageOrientation = "portrait" | "landscape"

// 採点マーク設定の型定義
export interface ScoringMarkConfig {
  // 表示設定
  showMarkForStatus: Record<ScoringStatus, boolean>
  showScoreForStatus: Record<ScoringStatus, boolean>
  
  // 採点マーク用設定
  markPosition: MarkPosition
  markOffsetX: number // X軸オフセット（-100 to 100）
  markOffsetY: number // Y軸オフセット（-100 to 100）
  markSize: number // マークサイズ（20 to 200）
  
  // 点数テキスト用設定
  scorePosition: MarkPosition
  scoreOffsetX: number // X軸オフセット（-100 to 100）
  scoreOffsetY: number // Y軸オフセット（-100 to 100）
  scoreSize: number // 点数サイズ（8 to 48）
  scoreAlignment: TextAlignment
  
  // 透明度設定
  useTransparent: boolean
  
  // PDF設定
  pageSize: PageSize
  pageOrientation: PageOrientation
  marginPercent: number // 余白パーセント（0-20）
}

// デフォルト設定
const defaultConfig: ScoringMarkConfig = {
  showMarkForStatus: {
    unscored: false,
    correct: true,
    partial: true,
    hold: true,
    incorrect: true,
    no_answer: true,
  },
  showScoreForStatus: {
    unscored: false,
    correct: true,
    partial: true,
    hold: true,
    incorrect: true,
    no_answer: true,
  },
  // 採点マーク設定
  markPosition: "middle-center",
  markOffsetX: 0,
  markOffsetY: 0,
  markSize: 50,
  // 点数テキスト設定
  scorePosition: "middle-center",  // デフォルトを中央に変更
  scoreOffsetX: 0,
  scoreOffsetY: 0,
  scoreSize: 14,
  scoreAlignment: "center",
  useTransparent: false,
  // PDF設定
  pageSize: "A4",
  pageOrientation: "portrait",
  marginPercent: 5, // 5%の余白
}

// localStorageのキー
const STORAGE_KEY = "scoring-mark-config"

// localStorageから設定を読み込む
function loadConfigFromStorage(): ScoringMarkConfig {
  if (typeof window === "undefined") return defaultConfig
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      return {
        ...defaultConfig,
        ...parsed,
        showMarkForStatus: {
          ...defaultConfig.showMarkForStatus,
          ...(parsed.showMarkForStatus || {})
        },
        showScoreForStatus: {
          ...defaultConfig.showScoreForStatus,
          ...(parsed.showScoreForStatus || {})
        }
      }
    }
  } catch (error) {
    console.error("Failed to load config from localStorage:", error)
  }
  
  return defaultConfig
}

// localStorageに設定を保存する
function saveConfigToStorage(config: ScoringMarkConfig) {
  if (typeof window === "undefined") return
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
  } catch (error) {
    console.error("Failed to save config to localStorage:", error)
  }
}

// 位置のラベル
const positionLabels: Record<MarkPosition, string> = {
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

// 採点状態のラベル
const statusLabels: Record<ScoringStatus, string> = {
  unscored: "未採点",
  correct: "正答",
  partial: "部分点",
  hold: "保留",
  incorrect: "誤答",
  no_answer: "無答",
}

interface ScoringMarkSettingsProps {
  config: ScoringMarkConfig
  onChange: (config: ScoringMarkConfig) => void
}

export default function ScoringMarkSettings({ config, onChange }: ScoringMarkSettingsProps) {
  const updateConfig = (updates: Partial<ScoringMarkConfig>) => {
    const newConfig = { ...config, ...updates }
    onChange(newConfig)
    saveConfigToStorage(newConfig)
  }

  const updateMarkStatusDisplay = (status: ScoringStatus, show: boolean) => {
    updateConfig({
      showMarkForStatus: {
        ...config.showMarkForStatus,
        [status]: show,
      }
    })
  }

  const updateScoreStatusDisplay = (status: ScoringStatus, show: boolean) => {
    updateConfig({
      showScoreForStatus: {
        ...config.showScoreForStatus,
        [status]: show,
      }
    })
  }

  const resetToDefaults = () => {
    onChange(defaultConfig)
    saveConfigToStorage(defaultConfig)
  }

  const getMarkImagePath = (status: ScoringStatus) => {
    const prefix = config.useTransparent ? "tranceparent_" : ""
    switch (status) {
      case "unscored": return `/score-assets/${prefix}unscored.png`
      case "correct": return `/score-assets/${prefix}correct.png`
      case "partial": return `/score-assets/${prefix}partial.png`
      case "hold": return `/score-assets/${prefix}hold.png`
      case "incorrect": return `/score-assets/${prefix}incorrect.png`
      case "no_answer": return `/score-assets/${prefix}incorrect.png` // 無答も誤答マークを使用
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Settings className="h-5 w-5" />
        <Label className="text-base font-medium">採点マーク設定</Label>
      </div>

      {/* 採点マークと点数の表示対象を左右対称に配置 */}
      <div className="grid grid-cols-2 gap-6">
        {/* 左側：採点マーク表示対象 */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">📌 採点マーク表示対象</Label>
          <div className="space-y-2">
            {(Object.keys(statusLabels) as ScoringStatus[]).map((status) => (
              <div key={`mark-${status}`} className="flex items-center space-x-3">
                <Checkbox
                  id={`mark-${status}`}
                  checked={config.showMarkForStatus[status]}
                  onCheckedChange={(checked) => 
                    updateMarkStatusDisplay(status, checked as boolean)
                  }
                />
                <div className="flex items-center space-x-2">
                  <img 
                    src={getMarkImagePath(status)}
                    alt={statusLabels[status]}
                    className="w-6 h-6"
                  />
                  <Label htmlFor={`mark-${status}`} className="text-sm cursor-pointer">
                    {statusLabels[status]}
                  </Label>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 右側：点数表示対象 */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">🔢 点数表示対象</Label>
          <div className="space-y-2">
            {(Object.keys(statusLabels) as ScoringStatus[]).map((status) => (
              <div key={`score-${status}`} className="flex items-center space-x-3">
                <Checkbox
                  id={`score-${status}`}
                  checked={config.showScoreForStatus[status]}
                  onCheckedChange={(checked) => 
                    updateScoreStatusDisplay(status, checked as boolean)
                  }
                />
                <div className="flex items-center space-x-2">
                  <span className="w-6 h-6 flex items-center justify-center text-red-600 font-bold text-sm border rounded">
                    10
                  </span>
                  <Label htmlFor={`score-${status}`} className="text-sm cursor-pointer">
                    {statusLabels[status]}
                  </Label>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 透明度設定 */}
      <div className="flex items-center space-x-2">
        <Checkbox
          id="use-transparent"
          checked={config.useTransparent}
          onCheckedChange={(checked) => 
            updateConfig({ useTransparent: checked as boolean })
          }
        />
        <Label htmlFor="use-transparent" className="text-sm font-medium">
          透明マークを使用
        </Label>
      </div>

      {/* 位置設定を左右対称に配置 */}
      <div className="grid grid-cols-2 gap-6">
        {/* 左側：採点マーク位置設定 */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">📌 採点マーク位置</Label>
          <Select 
            value={config.markPosition} 
            onValueChange={(value: MarkPosition) => updateConfig({ markPosition: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="位置を選択" />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(positionLabels) as MarkPosition[]).map((position) => (
                <SelectItem key={position} value={position}>
                  {positionLabels[position]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 右側：点数テキスト位置設定 */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">🔢 点数テキスト位置</Label>
          <Select 
            value={config.scorePosition} 
            onValueChange={(value: MarkPosition) => updateConfig({ scorePosition: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="位置を選択" />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(positionLabels) as MarkPosition[]).map((position) => (
                <SelectItem key={position} value={position}>
                  {positionLabels[position]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* オフセット設定を左右対称に配置 */}
      <div className="grid grid-cols-2 gap-6">
        {/* 左側：採点マークオフセット設定 */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">📌 採点マークオフセット</Label>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label className="text-xs">左右: {config.markOffsetX}px</Label>
              <Input
                type="range"
                value={config.markOffsetX}
                onChange={(e) => updateConfig({ markOffsetX: parseInt(e.target.value) })}
                min={-100}
                max={100}
                step={1}
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">上下: {config.markOffsetY}px</Label>
              <Input
                type="range"
                value={config.markOffsetY}
                onChange={(e) => updateConfig({ markOffsetY: parseInt(e.target.value) })}
                min={-100}
                max={100}
                step={1}
                className="w-full"
              />
            </div>
          </div>
        </div>

        {/* 右側：点数テキストオフセット設定 */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">🔢 点数テキストオフセット</Label>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label className="text-xs">左右: {config.scoreOffsetX}px</Label>
              <Input
                type="range"
                value={config.scoreOffsetX}
                onChange={(e) => updateConfig({ scoreOffsetX: parseInt(e.target.value) })}
                min={-100}
                max={100}
                step={1}
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">上下: {config.scoreOffsetY}px</Label>
              <Input
                type="range"
                value={config.scoreOffsetY}
                onChange={(e) => updateConfig({ scoreOffsetY: parseInt(e.target.value) })}
                min={-100}
                max={100}
                step={1}
                className="w-full"
              />
            </div>
          </div>
        </div>
      </div>

      {/* サイズ設定を左右対称に配置 */}
      <div className="grid grid-cols-2 gap-6">
        {/* 左側：採点マークサイズ */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">📌 マークサイズ: {config.markSize}px</Label>
          <Input
            type="range"
            value={config.markSize}
            onChange={(e) => updateConfig({ markSize: parseInt(e.target.value) })}
            min={20}
            max={200}
            step={5}
            className="w-full"
          />
        </div>

        {/* 右側：点数サイズ */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">🔢 点数サイズ: {config.scoreSize}px</Label>
          <Input
            type="range"
            value={config.scoreSize}
            onChange={(e) => updateConfig({ scoreSize: parseInt(e.target.value) })}
            min={8}
            max={48}
            step={1}
            className="w-full"
          />
        </div>
      </div>

      {/* テキスト配置設定を追加 */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">🔢 点数テキスト配置</Label>
        <ToggleGroup 
          type="single" 
          value={config.scoreAlignment} 
          onValueChange={(value: TextAlignment) => {
            if (value) updateConfig({ scoreAlignment: value })
          }}
          className="justify-start"
        >
          <ToggleGroupItem value="left" aria-label="左揃え">
            <AlignLeft className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="center" aria-label="中央揃え">
            <AlignCenter className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="right" aria-label="右揃え">
            <AlignRight className="h-4 w-4" />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* リセットボタン */}
      <div className="flex justify-end">
        <Button variant="outline" onClick={resetToDefaults}>
          デフォルトに戻す
        </Button>
      </div>
    </div>
  )
}

// デフォルト設定をエクスポート
export { defaultConfig as defaultScoringMarkConfig, loadConfigFromStorage, saveConfigToStorage }