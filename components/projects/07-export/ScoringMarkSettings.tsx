"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Settings } from "lucide-react"
import { useState } from "react"

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

// 採点マーク設定の型定義
export interface ScoringMarkConfig {
  // 表示設定
  showMarkForStatus: Record<ScoringStatus, boolean>
  showScore: boolean
  
  // 位置設定
  position: MarkPosition
  offsetX: number // X軸オフセット（-100 to 100）
  offsetY: number // Y軸オフセット（-100 to 100）
  
  // サイズ設定
  markSize: number // マークサイズ（20 to 200）
  scoreSize: number // 点数サイズ（8 to 48）
  
  // 透明度設定
  useTransparent: boolean
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
  showScore: true,
  position: "top-right",
  offsetX: 0,
  offsetY: 0,
  markSize: 50,
  scoreSize: 14,
  useTransparent: false,
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
  const [isExpanded, setIsExpanded] = useState(false)

  const updateConfig = (updates: Partial<ScoringMarkConfig>) => {
    onChange({ ...config, ...updates })
  }

  const updateStatusDisplay = (status: ScoringStatus, show: boolean) => {
    updateConfig({
      showMarkForStatus: {
        ...config.showMarkForStatus,
        [status]: show,
      }
    })
  }

  const resetToDefaults = () => {
    onChange(defaultConfig)
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            採点マーク設定
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? "閉じる" : "設定"}
          </Button>
        </CardTitle>
      </CardHeader>
      
      {isExpanded && (
        <CardContent className="space-y-6">
          {/* 表示対象の選択 */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">マーク表示対象</Label>
            <div className="grid grid-cols-2 gap-3">
              {(Object.keys(statusLabels) as ScoringStatus[]).map((status) => (
                <div key={status} className="flex items-center space-x-3">
                  <Checkbox
                    id={`status-${status}`}
                    checked={config.showMarkForStatus[status]}
                    onCheckedChange={(checked) => 
                      updateStatusDisplay(status, checked as boolean)
                    }
                  />
                  <div className="flex items-center space-x-2">
                    <img 
                      src={getMarkImagePath(status)}
                      alt={statusLabels[status]}
                      className="w-6 h-6"
                    />
                    <Label htmlFor={`status-${status}`} className="text-sm cursor-pointer">
                      {statusLabels[status]}
                    </Label>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 点数表示 */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="show-score"
              checked={config.showScore}
              onCheckedChange={(checked) => 
                updateConfig({ showScore: checked as boolean })
              }
            />
            <Label htmlFor="show-score" className="text-sm font-medium">
              点数を表示
            </Label>
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

          {/* 位置設定 */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">マーク位置</Label>
            <Select 
              value={config.position} 
              onValueChange={(value: MarkPosition) => updateConfig({ position: value })}
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

          {/* オフセット設定 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                X軸オフセット: {config.offsetX}px
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  type="range"
                  value={config.offsetX}
                  onChange={(e) => updateConfig({ offsetX: parseInt(e.target.value) })}
                  min={-100}
                  max={100}
                  step={1}
                  className="flex-1"
                />
                <Input
                  type="number"
                  value={config.offsetX}
                  onChange={(e) => updateConfig({ offsetX: parseInt(e.target.value) || 0 })}
                  min={-100}
                  max={100}
                  className="w-16"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Y軸オフセット: {config.offsetY}px
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  type="range"
                  value={config.offsetY}
                  onChange={(e) => updateConfig({ offsetY: parseInt(e.target.value) })}
                  min={-100}
                  max={100}
                  step={1}
                  className="flex-1"
                />
                <Input
                  type="number"
                  value={config.offsetY}
                  onChange={(e) => updateConfig({ offsetY: parseInt(e.target.value) || 0 })}
                  min={-100}
                  max={100}
                  className="w-16"
                />
              </div>
            </div>
          </div>

          {/* サイズ設定 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                マークサイズ: {config.markSize}px
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  type="range"
                  value={config.markSize}
                  onChange={(e) => updateConfig({ markSize: parseInt(e.target.value) })}
                  min={20}
                  max={200}
                  step={5}
                  className="flex-1"
                />
                <Input
                  type="number"
                  value={config.markSize}
                  onChange={(e) => updateConfig({ markSize: parseInt(e.target.value) || 50 })}
                  min={20}
                  max={200}
                  className="w-16"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                点数サイズ: {config.scoreSize}px
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  type="range"
                  value={config.scoreSize}
                  onChange={(e) => updateConfig({ scoreSize: parseInt(e.target.value) })}
                  min={8}
                  max={48}
                  step={1}
                  className="flex-1"
                />
                <Input
                  type="number"
                  value={config.scoreSize}
                  onChange={(e) => updateConfig({ scoreSize: parseInt(e.target.value) || 14 })}
                  min={8}
                  max={48}
                  className="w-16"
                />
              </div>
            </div>
          </div>

          {/* リセットボタン */}
          <div className="flex justify-end">
            <Button variant="outline" onClick={resetToDefaults}>
              デフォルトに戻す
            </Button>
          </div>

          {/* プレビュー */}
          <div className="border rounded-lg p-4 bg-gray-50">
            <Label className="text-sm font-medium mb-2 block">プレビュー</Label>
            <div className="relative w-32 h-32 bg-white border-2 border-dashed border-gray-300 rounded">
              {/* プレビュー画像を表示 */}
              <div 
                className="absolute"
                style={{
                  [config.position.includes('top') ? 'top' : 
                   config.position.includes('bottom') ? 'bottom' : 'top']: 
                   config.position.includes('top') ? `${config.offsetY + 8}px` :
                   config.position.includes('bottom') ? `${-config.offsetY + 8}px` : '50%',
                  [config.position.includes('left') ? 'left' : 
                   config.position.includes('right') ? 'right' : 'left']: 
                   config.position.includes('left') ? `${config.offsetX + 8}px` :
                   config.position.includes('right') ? `${-config.offsetX + 8}px` : '50%',
                  transform: config.position === 'middle-center' ? 'translate(-50%, -50%)' : 'none'
                }}
              >
                <div className="flex items-center gap-1">
                  <img 
                    src={getMarkImagePath('correct')}
                    alt="プレビュー"
                    style={{ width: `${config.markSize}px`, height: `${config.markSize}px` }}
                  />
                  {config.showScore && (
                    <span 
                      style={{ fontSize: `${config.scoreSize}px` }}
                      className="font-bold text-red-600"
                    >
                      10/10
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  )
}

// デフォルト設定をエクスポート
export { defaultConfig as defaultScoringMarkConfig }