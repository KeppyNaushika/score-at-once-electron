"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Monitor, PanelLeftClose } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import {
  SIDEBAR_SECTIONS,
  type SidebarBehavior,
} from "@/components/layout/AppShell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useCurrentUser } from "@/contexts/CurrentUserContext"
import { parsePreference } from "@/lib/userPreferences"
import {
  projectorModeQuery,
  setProjectorModeMutation,
  setUserPreferenceMutation,
  userPreferenceQuery,
} from "@/queries/settings"

export function ScreenControlTab() {
  // プロジェクターモード
  // 現在のプロジェクターモード（main が持つ状態。localStorage 側とは出所が違う）
  const queryClient = useQueryClient()
  const projectorModeKey = projectorModeQuery().queryKey
  const { data: savedProjectorMode } = useQuery(projectorModeQuery())
  const setProjectorMode = useMutation(setProjectorModeMutation())
  const projectorMode = savedProjectorMode ?? false

  // 画面消灯。目隠しの本体（ScreenBlackout）と同じキャッシュを読み書きするので、
  // 変更を伝える自作イベントは要らない
  const userId = useCurrentUser().id
  const setPreference = useMutation(setUserPreferenceMutation(userId))
  const { data: storedBlackoutEnabled } = useQuery(
    userPreferenceQuery(userId, "screenBlackoutEnabled")
  )
  const { data: storedBlackoutMinutes } = useQuery(
    userPreferenceQuery(userId, "screenBlackoutTimeoutMinutes")
  )
  const { data: storedAutoFullScreen } = useQuery(
    userPreferenceQuery(userId, "screenBlackoutAutoFullScreen")
  )
  const blackoutEnabled = parsePreference(
    "screenBlackoutEnabled",
    storedBlackoutEnabled ?? null
  )
  const blackoutMinutes = parsePreference(
    "screenBlackoutTimeoutMinutes",
    storedBlackoutMinutes ?? null
  )
  const autoFullScreen = parsePreference(
    "screenBlackoutAutoFullScreen",
    storedAutoFullScreen ?? null
  )

  // サイドバー動作（セクション別）
  const [sidebarBehaviors, setSidebarBehaviors] = useState<
    Record<string, SidebarBehavior>
  >(() =>
    Object.fromEntries(SIDEBAR_SECTIONS.map((section) => [section.key, "none"]))
  )

  useEffect(() => {
    const loadSettings = () => {
      // サイドバー動作の設定を読み込み（セクション別）
      try {
        const loaded: Record<string, SidebarBehavior> = {}
        for (const section of SIDEBAR_SECTIONS) {
          const stored = localStorage.getItem(section.storageKey)
          if (
            stored === "collapse" ||
            stored === "expand" ||
            stored === "none"
          ) {
            loaded[section.key] = stored
          } else {
            loaded[section.key] = "none"
          }
        }
        setSidebarBehaviors(loaded)
      } catch {
        // ignore
      }
    }

    loadSettings()
  }, [])

  // プロジェクターモードの切り替え
  const handleProjectorModeToggle = useCallback(
    (enabled: boolean) => {
      setProjectorMode.mutate(enabled, {
        // 切り替え後の実際の状態を返すので、要求値ではなくそちらを採る
        onSuccess: (applied) => {
          queryClient.setQueryData(projectorModeKey, applied)
          toast.success(
            enabled
              ? "プロジェクターモードを有効にしました"
              : "プロジェクターモードを無効にしました"
          )
        },
        onError: () =>
          void queryClient.invalidateQueries({ queryKey: projectorModeKey }),
      })
    },
    [projectorModeKey, queryClient, setProjectorMode]
  )

  const handleBlackoutToggle = useCallback(
    (enabled: boolean) => {
      setPreference.mutate({ key: "screenBlackoutEnabled", value: enabled })
      toast.success(
        enabled ? "画面消灯を有効にしました" : "画面消灯を無効にしました"
      )
    },
    [setPreference]
  )

  const handleBlackoutMinutesChange = useCallback(
    (value: string) => {
      const minutes = Math.max(1, Math.min(60, parseInt(value) || 1))
      setPreference.mutate({
        key: "screenBlackoutTimeoutMinutes",
        value: minutes,
      })
    },
    [setPreference]
  )

  const handleAutoFullScreenToggle = useCallback(
    (enabled: boolean) => {
      setPreference.mutate({
        key: "screenBlackoutAutoFullScreen",
        value: enabled,
      })
      toast.success(
        enabled
          ? "消灯時の自動フルスクリーンを有効にしました"
          : "消灯時の自動フルスクリーンを無効にしました"
      )
    },
    [setPreference]
  )

  // サイドバー動作の変更（セクション別）
  const handleSidebarBehaviorChange = useCallback(
    (sectionKey: string, behavior: SidebarBehavior) => {
      setSidebarBehaviors((prev) => ({ ...prev, [sectionKey]: behavior }))
      const section = SIDEBAR_SECTIONS.find(
        (candidate) => candidate.key === sectionKey
      )
      if (section) {
        localStorage.setItem(section.storageKey, behavior)
      }
      const labels: Record<SidebarBehavior, string> = {
        collapse: "縮小する",
        expand: "展開する",
        none: "変更しない",
      }
      const sectionLabel = section?.label ?? ""
      toast.success(
        `${sectionLabel}のサイドバー動作を「${labels[behavior]}」に設定しました`
      )
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
          <p className="text-sm text-muted-foreground">
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
              <p className="text-xs text-muted-foreground">
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
              <p className="text-xs text-muted-foreground">
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
            <Label className="text-sm text-muted-foreground">
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
              <span className="text-sm text-muted-foreground">分</span>
            </div>
          </div>

          <div className="border-t" />

          {/* 自動フルスクリーン */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">
                消灯時に自動フルスクリーン
              </Label>
              <p className="text-xs text-muted-foreground">
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
          <p className="text-sm text-muted-foreground">
            各画面を開いた際のサイドバーの動作をセクションごとに設定します
          </p>
        </div>

        <div className="space-y-3 rounded-lg border p-4">
          {SIDEBAR_SECTIONS.map((section, index) => (
            <div key={section.key}>
              {index > 0 && <div className="my-3 border-t" />}
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">{section.label}</Label>
                <div className="flex items-center gap-1.5">
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
                        sidebarBehaviors[section.key] === option.value
                          ? "default"
                          : "outline"
                      }
                      size="sm"
                      onClick={() =>
                        handleSidebarBehaviorChange(section.key, option.value)
                      }
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
