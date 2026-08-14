"use client"

import { useQuery } from "@tanstack/react-query"
import { RotateCcw } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import {
  type ClickScoringAction,
  toClickScoringAction,
  toClickScoringConfig,
} from "@/components/exams/07-score-at-once/ScoringMain/scoringPreferences"
import { Button } from "@/components/ui/button"
import { ColorPicker } from "@/components/ui/color-picker"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { useAuth } from "@/contexts/AuthContext"
import { useWritePreference } from "@/hooks/useWritePreference"
import {
  applyScoringColorPreset,
  getCurrentPresetId,
  getScoringStatusColors,
  loadScoringStatusColors,
  saveScoringStatusColors,
  SCORING_COLOR_PRESETS,
  SCORING_STATUS_LABELS,
  SCORING_STATUS_ORDER,
  type ScoringStatusColors,
} from "@/lib/scoringStatusColors"
import { parsePreference } from "@/lib/userPreferences"
import { cn } from "@/lib/utils"
import { userPreferenceQuery } from "@/queries/settings"
import type { ScoringStatus } from "@/types/scoringStatus.types"

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
  const initializedUserIdRef = useRef<string | undefined>(undefined)

  // 選択枠色・クリック採点設定は採点画面と同じフックを使う。ここで読み書きすると
  // 採点画面のキャッシュも同時に更新されるので、変更を伝える自作イベントは要らない
  const { data: storedSelectionBorderColor } = useQuery(
    userPreferenceQuery(userId, "selectionBorderColor")
  )
  const { data: storedClickScoringConfig } = useQuery(
    userPreferenceQuery(userId, "clickScoringConfig")
  )
  const { data: storedClickScoringDebounceMs } = useQuery(
    userPreferenceQuery(userId, "clickScoringDebounceMs")
  )
  const writePreference = useWritePreference(userId)

  const selectionBorderColor =
    parsePreference(
      "selectionBorderColor",
      storedSelectionBorderColor ?? null
    ) ?? DEFAULT_SELECTION_BORDER_COLOR
  const clickScoringConfig = toClickScoringConfig(
    parsePreference("clickScoringConfig", storedClickScoringConfig ?? null)
  )
  const clickScoringDebounceMs = parsePreference(
    "clickScoringDebounceMs",
    storedClickScoringDebounceMs ?? null
  )

  const setClickAction = (
    clickCount: 2 | 3 | 4,
    action: ClickScoringAction
  ) => {
    writePreference(
      "clickScoringConfig",
      JSON.stringify({ ...clickScoringConfig, [clickCount]: action })
    )
  }
  const setClickScoringDebounceMs = (value: number) =>
    writePreference("clickScoringDebounceMs", value)

  // 採点状態色の状態
  const [scoringColors, setScoringColors] = useState<ScoringStatusColors>(
    getScoringStatusColors
  )
  const [currentPresetId, setCurrentPresetId] = useState<string | null>(
    getCurrentPresetId
  )

  // 初期値をロード（KV方式）
  useEffect(() => {
    if (initializedUserIdRef.current === userId) return
    if (!userId) return

    initializedUserIdRef.current = userId

    const loadSettings = async () => {
      await loadScoringStatusColors(userId)
      setScoringColors(getScoringStatusColors())
      setCurrentPresetId(getCurrentPresetId())
    }

    loadSettings()
  }, [userId])

  // 選択枠色の変更（KV方式・楽観的更新）
  const handleSelectionBorderColorChange = useCallback(
    (color: string) => {
      writePreference("selectionBorderColor", color.toUpperCase())
      toast.success("選択枠色が変更されました")
    },
    [writePreference]
  )

  // クリック採点アクション変更
  const handleClickActionChange = setClickAction

  const handleDebounceMsChange = setClickScoringDebounceMs

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
      status: ScoringStatus,
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
      {/* クリックで採点 */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">クリックで採点</h2>
          <p className="text-sm text-muted-foreground">
            一括採点でのマウスクリック操作を設定できます
          </p>
        </div>

        <div className="space-y-3">
          {([2, 3, 4] as const).map((clickCount) => {
            const labels = {
              2: "ダブルクリック",
              3: "トリプルクリック",
              4: "クアトロクリック",
            }
            const actionOptions = [
              { value: "none", label: "なし" },
              { value: "correct", label: "正答" },
              { value: "incorrect", label: "誤答" },
              { value: "partial_modal", label: "部分点入力" },
              { value: "partial", label: "部分点（非推奨）" },
              { value: "pending", label: "保留（非推奨）" },
              { value: "unscored", label: "未採点" },
              { value: "no_answer", label: "無答" },
              { value: "double_mark", label: "Wマーク" },
              { value: "individual", label: "個別表示" },
            ]
            return (
              <div key={clickCount} className="flex items-center gap-3">
                <Label className="w-36 shrink-0 text-sm">
                  {labels[clickCount]}
                </Label>
                <select
                  className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                  value={
                    clickScoringConfig[
                      clickCount as keyof typeof clickScoringConfig
                    ]
                  }
                  onChange={(e) =>
                    handleClickActionChange(
                      clickCount,
                      toClickScoringAction(e.target.value)
                    )
                  }
                >
                  {actionOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            )
          })}

          {/* デバウンス時間 */}
          <div className="space-y-1 pt-2">
            <Label className="text-sm">クリック判定の待ち時間</Label>
            <div className="flex items-center gap-2">
              <span className="shrink-0 text-lg" title="速い">
                🐇
              </span>
              <Slider
                className="flex-1"
                value={[clickScoringDebounceMs]}
                min={100}
                max={800}
                step={50}
                onValueChange={([v]) => handleDebounceMsChange(v)}
              />
              <span className="shrink-0 text-lg" title="遅い">
                🐢
              </span>
              <span className="w-14 shrink-0 text-right text-sm text-muted-foreground">
                {clickScoringDebounceMs}ms
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 選択枠の色 */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">選択枠の色</h2>
          <p className="text-sm text-muted-foreground">
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
            <span className="text-sm text-muted-foreground">カスタム:</span>
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
            <p className="text-sm text-muted-foreground">
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
                      <span className="text-xs text-muted-foreground">
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
                      <span className="text-xs text-muted-foreground">
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
                      <span className="text-xs text-muted-foreground">
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
