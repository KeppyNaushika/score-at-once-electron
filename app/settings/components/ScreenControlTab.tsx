"use client"

import { Monitor, PanelLeftClose } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import {
  SIDEBAR_BEHAVIOR_KEY,
  type SidebarBehavior,
} from "@/components/layout/AppShell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

const BLACKOUT_SETTINGS_KEY = "screenBlackoutSettings"

export function ScreenControlTab() {
  // プロジェクターモード
  const [projectorMode, setProjectorMode] = useState(false)

  // 画面消灯
  const [blackoutEnabled, setBlackoutEnabled] = useState(false)
  const [blackoutMinutes, setBlackoutMinutes] = useState(5)
  const [autoFullScreen, setAutoFullScreen] = useState(false)

  // サイドバー動作
  const [sidebarBehavior, setSidebarBehavior] =
    useState<SidebarBehavior>("collapse")

  useEffect(() => {
    const loadSettings = async () => {
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

      // サイドバー動作の設定を読み込み
      try {
        const storedBehavior = localStorage.getItem(SIDEBAR_BEHAVIOR_KEY)
        if (
          storedBehavior === "collapse" ||
          storedBehavior === "expand" ||
          storedBehavior === "none"
        ) {
          setSidebarBehavior(storedBehavior)
        }
      } catch {
        // ignore
      }
    }

    loadSettings()
  }, [])

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

  // サイドバー動作の変更
  const handleSidebarBehaviorChange = useCallback(
    (behavior: SidebarBehavior) => {
      setSidebarBehavior(behavior)
      localStorage.setItem(SIDEBAR_BEHAVIOR_KEY, behavior)
      const labels: Record<SidebarBehavior, string> = {
        collapse: "縮小する",
        expand: "展開する",
        none: "変更しない",
      }
      toast.success(`サイドバー動作を「${labels[behavior]}」に設定しました`)
    },
    []
  )

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

      {/* サイドバー動作 */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">
            <PanelLeftClose className="mr-2 inline-block h-5 w-5" />
            サイドバー動作
          </h2>
          <p className="text-muted-foreground text-sm">
            採点・解答用紙作成画面を開いた際のサイドバーの動作を設定します
          </p>
        </div>

        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2">
            {(
              [
                { value: "collapse", label: "縮小する" },
                { value: "expand", label: "展開する" },
                { value: "none", label: "変更しない" },
              ] as const
            ).map((option) => (
              <Button
                key={option.value}
                variant={
                  sidebarBehavior === option.value ? "default" : "outline"
                }
                size="sm"
                onClick={() => handleSidebarBehaviorChange(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
