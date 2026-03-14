"use client"

import { Monitor, RotateCcw } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { ColorPicker } from "@/components/ui/color-picker"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useAuth } from "@/contexts/AuthContext"
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
  type ScoringStatusType,
} from "@/lib/scoringStatusColors"
import { cn } from "@/lib/utils"

const DEFAULT_SELECTION_BORDER_COLOR = "#F97316"
const BLACKOUT_SETTINGS_KEY = "screenBlackoutSettings"
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

  // プロジェクターモード
  const [projectorMode, setProjectorMode] = useState(false)

  // 画面消灯
  const [blackoutEnabled, setBlackoutEnabled] = useState(false)
  const [blackoutMinutes, setBlackoutMinutes] = useState(5)
  const [autoFullScreen, setAutoFullScreen] = useState(false)

  // 初期値をロード（カラム別）
  useEffect(() => {
    // 同じユーザーで既に初期化済みならスキップ
    if (initializedUserIdRef.current === userId) return

    // userIdがundefinedの場合は待機（refは更新しない）
    if (!userId) return

    // 新しいユーザーとして初期化
    initializedUserIdRef.current = userId

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

      // プロジェクターモードの現在状態を取得
      if (window.electronAPI?.settings?.getProjectorMode) {
        const pmResult = await window.electronAPI.settings.getProjectorMode()
        if (pmResult.success) {
          setProjectorMode(pmResult.active ?? false)
        }
      }

      // 画面消灯の設定を読み込み
      try {
        const stored = localStorage.getItem(BLACKOUT_SETTINGS_KEY)
        if (stored) {
          const parsed = JSON.parse(stored)
          setBlackoutEnabled(parsed.enabled ?? false)
          setBlackoutMinutes(parsed.timeoutMinutes ?? 5)
          setAutoFullScreen(parsed.autoFullScreen ?? false)
        }
      } catch {
        // ignore
      }
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

  // プロジェクターモードの切り替え
  const handleProjectorModeToggle = useCallback(async (enabled: boolean) => {
    setProjectorMode(enabled)
    if (window.electronAPI?.settings?.setProjectorMode) {
      try {
        const result =
          await window.electronAPI.settings.setProjectorMode(enabled)
        if (result.success) {
          toast.success(
            enabled
              ? "プロジェクターモードを有効にしました"
              : "プロジェクターモードを無効にしました"
          )
        } else {
          setProjectorMode(!enabled)
          toast.error("プロジェクターモードの切り替えに失敗しました")
        }
      } catch {
        setProjectorMode(!enabled)
        toast.error("プロジェクターモードの切り替えに失敗しました")
      }
    }
  }, [])

  // 画面消灯設定の保存
  const saveBlackoutSettings = useCallback(
    (enabled: boolean, minutes: number, fullScreen: boolean) => {
      const settings = {
        enabled,
        timeoutMinutes: minutes,
        autoFullScreen: fullScreen,
      }
      localStorage.setItem(BLACKOUT_SETTINGS_KEY, JSON.stringify(settings))
      window.dispatchEvent(new CustomEvent("screenBlackoutSettingsChanged"))
    },
    []
  )

  const handleBlackoutToggle = useCallback(
    (enabled: boolean) => {
      setBlackoutEnabled(enabled)
      saveBlackoutSettings(enabled, blackoutMinutes, autoFullScreen)
      toast.success(
        enabled ? "画面消灯を有効にしました" : "画面消灯を無効にしました"
      )
    },
    [blackoutMinutes, autoFullScreen, saveBlackoutSettings]
  )

  const handleBlackoutMinutesChange = useCallback(
    (value: string) => {
      const minutes = Math.max(1, Math.min(60, parseInt(value) || 1))
      setBlackoutMinutes(minutes)
      saveBlackoutSettings(blackoutEnabled, minutes, autoFullScreen)
    },
    [blackoutEnabled, autoFullScreen, saveBlackoutSettings]
  )

  const handleAutoFullScreenToggle = useCallback(
    (enabled: boolean) => {
      setAutoFullScreen(enabled)
      saveBlackoutSettings(blackoutEnabled, blackoutMinutes, enabled)
      toast.success(
        enabled
          ? "消灯時の自動フルスクリーンを有効にしました"
          : "消灯時の自動フルスクリーンを無効にしました"
      )
    },
    [blackoutEnabled, blackoutMinutes, saveBlackoutSettings]
  )

  const isPresetSelected = (presetId: string) => currentPresetId === presetId

  return (
    <div className="space-y-8">
      {/* プロジェクターモード・画面消灯 */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">
            <Monitor className="mr-2 inline-block h-5 w-5" />
            画面制御
          </h2>
          <p className="text-muted-foreground text-sm">
            スクリーンセーバーの無効化や、一定時間後の画面消灯を設定できます。
            <kbd className="mx-1 rounded border border-gray-300 px-1 py-0.5 text-xs">
              {navigator.platform?.includes("Mac") ? "⌘" : "Ctrl"}+L
            </kbd>
            で手動消灯できます（数字パスコード設定時はロック付き）
          </p>
        </div>

        <div className="space-y-4 rounded-lg border p-4">
          {/* プロジェクターモード */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">
                プロジェクターモード
              </Label>
              <p className="text-muted-foreground text-xs">
                スクリーンセーバーとスリープを無効化します
              </p>
            </div>
            <Switch
              checked={projectorMode}
              onCheckedChange={handleProjectorModeToggle}
            />
          </div>

          <div className="border-t" />

          {/* 画面消灯 */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">画面消灯</Label>
              <p className="text-muted-foreground text-xs">
                操作がない場合、画面を黒くします。数字パスコード設定時はロック解除が必要です（再読み込みで解除可）
              </p>
            </div>
            <Switch
              checked={blackoutEnabled}
              onCheckedChange={handleBlackoutToggle}
            />
          </div>

          {/* 消灯までの時間 */}
          <div className="flex items-center gap-3 pl-4">
            <Label className="text-muted-foreground text-sm">
              消灯までの時間
            </Label>
            <div className="flex items-center gap-1.5">
              <Input
                type="number"
                min={1}
                max={60}
                value={blackoutMinutes}
                onChange={(e) => handleBlackoutMinutesChange(e.target.value)}
                className="w-16"
              />
              <span className="text-muted-foreground text-sm">分</span>
            </div>
          </div>

          <div className="border-t" />

          {/* 自動フルスクリーン */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">
                消灯時に自動フルスクリーン
              </Label>
              <p className="text-muted-foreground text-xs">
                消灯・ロック時にウィンドウをフルスクリーンにします
              </p>
            </div>
            <Switch
              checked={autoFullScreen}
              onCheckedChange={handleAutoFullScreenToggle}
            />
          </div>
        </div>
      </section>

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
