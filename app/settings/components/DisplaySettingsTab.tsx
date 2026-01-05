"use client"

import { useAuth } from "@/contexts/AuthContext"
import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { ColorPicker } from "@/components/ui/color-picker"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  getScoringStatusColors,
  loadScoringStatusColors,
  saveScoringStatusColors,
  applyScoringColorPreset,
  getCurrentPresetId,
  SCORING_COLOR_PRESETS,
  SCORING_STATUS_LABELS,
  SCORING_STATUS_ORDER,
  type ScoringStatusColors,
  type ScoringStatusType,
} from "@/lib/scoringStatusColors"
import { RotateCcw } from "lucide-react"

const DEFAULT_SELECTION_BORDER_COLOR = "#F97316"
const SELECTION_BORDER_PRESETS = [
  "#F97316", // オレンジ
  "#3B82F6", // 青
  "#EF4444", // 赤
  "#10B981", // エメラルド
  "#8B5CF6", // バイオレット
  "#F59E0B", // アンバー
]

export function DisplaySettingsTab() {
  const { user } = useAuth()
  const userId = user?.id
  const initializedRef = useRef(false)

  // 選択枠色の状態
  const [selectionBorderColor, setSelectionBorderColor] = useState(
    DEFAULT_SELECTION_BORDER_COLOR
  )

  // 採点状態色の状態
  const [scoringColors, setScoringColors] = useState<ScoringStatusColors>(
    getScoringStatusColors
  )
  const [currentPresetId, setCurrentPresetId] = useState<string | null>(
    getCurrentPresetId
  )

  // 初期値をロード（カラム別）
  useEffect(() => {
    if (initializedRef.current || !userId) return
    initializedRef.current = true

    const loadSettings = async () => {
      if (window.electronAPI?.settings) {
        try {
          // selectionBorderColorカラムのみ読み込み
          const result =
            await window.electronAPI.settings.getScoringPreferenceColumn(
              userId,
              "selectionBorderColor"
            )
          if (result.success && result.value) {
            setSelectionBorderColor(result.value)
          }
        } catch (error) {
          console.error("選択枠色の読み込みに失敗しました:", error)
        }
      }

      // 採点状態色をDBから読み込み（scoringStatusColorsは内部でカラム別読み込み）
      await loadScoringStatusColors(userId)
      setScoringColors(getScoringStatusColors())
      setCurrentPresetId(getCurrentPresetId())
    }

    loadSettings()
  }, [userId])

  // 選択枠色の変更（カラム別・楽観的更新）
  const handleSelectionBorderColorChange = useCallback(
    async (color: string) => {
      const upperColor = color.toUpperCase()
      setSelectionBorderColor(upperColor)

      if (userId && window.electronAPI?.settings) {
        try {
          await window.electronAPI.settings.setScoringPreferenceColumn(
            userId,
            "selectionBorderColor",
            upperColor
          )
          window.dispatchEvent(new CustomEvent("selectionBorderColorChanged"))
          toast.success("選択枠色が変更されました")
        } catch (error) {
          console.error("選択枠色の保存に失敗しました:", error)
          toast.error("選択枠色の保存に失敗しました")
        }
      }
    },
    [userId]
  )

  // プリセット選択
  const handlePresetSelect = useCallback(
    async (presetId: string) => {
      await applyScoringColorPreset(presetId, userId || undefined)
      setScoringColors(getScoringStatusColors())
      setCurrentPresetId(presetId)
      toast.success("カラープリセットが適用されました")
    },
    [userId]
  )

  // 個別の色変更
  const handleStatusColorChange = useCallback(
    async (
      status: ScoringStatusType,
      type: "bg" | "text" | "icon",
      color: string
    ) => {
      const updated: ScoringStatusColors = {
        ...scoringColors,
        [status]: {
          ...scoringColors[status],
          [type]: color.toUpperCase(),
        },
      }
      setScoringColors(updated)
      setCurrentPresetId(null)
      await saveScoringStatusColors(updated, userId || undefined)
    },
    [scoringColors, userId]
  )

  // リセット
  const handleReset = useCallback(async () => {
    await handlePresetSelect("default")
  }, [handlePresetSelect])

  const isPresetSelected = (presetId: string) => currentPresetId === presetId

  return (
    <div className="space-y-8">
      {/* 選択枠の色 */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">選択枠の色</h2>
          <p className="text-muted-foreground text-sm">
            一括採点における選択答案の枠色を変更できます
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* プリセット色 */}
          {SELECTION_BORDER_PRESETS.map((color) => (
            <button
              key={color}
              onClick={() => handleSelectionBorderColorChange(color)}
              className={cn(
                "h-8 w-8 rounded-lg border-2 transition-all hover:scale-105",
                selectionBorderColor === color
                  ? "scale-110 border-gray-800 shadow-md"
                  : "border-gray-200 hover:border-gray-300"
              )}
              style={{ backgroundColor: color }}
              aria-label={`色 ${color}`}
            />
          ))}

          {/* カスタム色ピッカー */}
          <div className="ml-2 flex items-center gap-2">
            <span className="text-muted-foreground text-sm">カスタム:</span>
            <ColorPicker
              value={selectionBorderColor}
              onChange={handleSelectionBorderColorChange}
              className={cn(
                !SELECTION_BORDER_PRESETS.includes(selectionBorderColor) &&
                  "ring-2 ring-gray-400"
              )}
            />
          </div>
        </div>
      </section>

      {/* 採点状態の表示色 */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">採点状態の表示色</h2>
            <p className="text-muted-foreground text-sm">
              採点パネル・一覧の背景色を変更できます
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="mr-2 h-4 w-4" />
            リセット
          </Button>
        </div>

        {/* プリセット選択 */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">プリセット</Label>
          <div className="flex flex-wrap gap-2">
            {SCORING_COLOR_PRESETS.map((preset) => (
              <Button
                key={preset.id}
                variant={isPresetSelected(preset.id) ? "default" : "outline"}
                size="sm"
                onClick={() => handlePresetSelect(preset.id)}
                title={preset.description}
              >
                {preset.name}
              </Button>
            ))}
          </div>
        </div>

        {/* 個別カスタマイズ */}
        <div className="rounded-lg border p-4">
          <div className="space-y-3">
            {SCORING_STATUS_ORDER.map((status) => {
              const colors = scoringColors[status]
              return (
                <div
                  key={status}
                  className="flex items-center justify-between gap-4"
                >
                  {/* ステータスラベル */}
                  <div className="w-20 text-sm font-medium">
                    {SCORING_STATUS_LABELS[status]}
                  </div>

                  {/* プレビュー */}
                  <div
                    className="flex h-8 w-24 items-center justify-center rounded text-xs font-medium"
                    style={{
                      backgroundColor: colors.bg,
                      color: colors.text,
                    }}
                  >
                    サンプル
                  </div>

                  {/* 色設定 */}
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground text-xs">
                        背景
                      </span>
                      <ColorPicker
                        value={colors.bg}
                        onChange={(c) =>
                          handleStatusColorChange(status, "bg", c)
                        }
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground text-xs">
                        文字
                      </span>
                      <ColorPicker
                        value={colors.text}
                        onChange={(c) =>
                          handleStatusColorChange(status, "text", c)
                        }
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground text-xs">
                        アイコン
                      </span>
                      <ColorPicker
                        value={colors.icon}
                        onChange={(c) =>
                          handleStatusColorChange(status, "icon", c)
                        }
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>
    </div>
  )
}
