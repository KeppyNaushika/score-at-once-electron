"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Monitor, PanelLeftClose } from "lucide-react"
import { useCallback } from "react"
import { toast } from "sonner"

import { SidebarBehaviorRow } from "@/app/(app)/settings/components/SidebarBehaviorRow"
import { SIDEBAR_SECTIONS } from "@/components/layout/sidebarBehavior"
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
              <SidebarBehaviorRow section={section} />
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
