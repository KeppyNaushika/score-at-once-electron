"use client"

import { AlertCircle, CheckCircle2, Loader2, RefreshCw } from "lucide-react"
import { toast } from "sonner"

import { useSyncSettings } from "@/app/settings/hooks/useSyncSettings"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

function StateIndicator({ state }: { state: string }) {
  switch (state) {
    case "idle":
      return (
        <span className="flex items-center gap-1.5 text-sm text-green-600">
          <CheckCircle2 className="h-4 w-4" />
          待機中
        </span>
      )
    case "syncing":
      return (
        <span className="flex items-center gap-1.5 text-sm text-blue-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          同期中...
        </span>
      )
    case "error":
      return (
        <span className="flex items-center gap-1.5 text-sm text-red-600">
          <AlertCircle className="h-4 w-4" />
          エラー
        </span>
      )
    default:
      return <span className="text-muted-foreground text-sm">無効</span>
  }
}

export function SyncSettingsTab() {
  const { config, syncPath, status, isLoading, updateConfig, triggerSync } =
    useSyncSettings()

  if (isLoading || !config) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
      </div>
    )
  }

  const handleToggleEnabled = async (enabled: boolean) => {
    // 無効化時は確認ダイアログを表示
    if (!enabled) {
      const confirmed = window.confirm(
        "同期を無効にすると、ローカルDBの変更をNASに反映してからローカルDBを削除します。\n\nよろしいですか？"
      )
      if (!confirmed) return
    }

    const result = await updateConfig({ enabled })
    if (result.success) {
      toast.success(
        enabled
          ? "同期を有効にしました（ローカルDBを作成）"
          : "同期を無効にしました（ローカルDBをNASに書き戻し）"
      )
    } else {
      toast.error(result.error ?? "設定の保存に失敗しました")
    }
  }

  const handleIntervalChange = async (value: string) => {
    const seconds = parseInt(value, 10)
    if (isNaN(seconds) || seconds < 5) return
    await updateConfig({ intervalMs: seconds * 1000 })
  }

  const handleTriggerSync = async () => {
    const result = await triggerSync()
    if (result.success) {
      toast.success("同期が完了しました")
    } else {
      toast.error(result.error ?? "同期に失敗しました")
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">同期設定</h2>
        <p className="text-muted-foreground text-sm">
          データディレクトリ内の同期フォルダを介して複数PCのデータを同期します。
        </p>
      </div>

      {/* 同期の有効/無効 */}
      <div className="flex items-center justify-between rounded-lg border p-4">
        <div className="space-y-0.5">
          <Label className="text-base">NAS同期</Label>
          <p className="text-muted-foreground text-sm">
            データディレクトリ内での自動同期を有効にします
          </p>
        </div>
        <Switch
          checked={config.enabled}
          onCheckedChange={handleToggleEnabled}
        />
      </div>

      {/* 同期フォルダ（自動導出、読み取り専用） */}
      <div className="space-y-2">
        <Label>同期フォルダ</Label>
        <Input
          value={syncPath || "未設定"}
          readOnly
          className="bg-muted font-mono text-xs"
        />
        <p className="text-muted-foreground text-xs">
          データディレクトリ内に自動作成されます
        </p>
      </div>

      {/* 同期間隔 */}
      <div className="space-y-2">
        <Label>同期間隔（秒）</Label>
        <Input
          type="number"
          min={5}
          max={3600}
          defaultValue={Math.round(config.intervalMs / 1000)}
          onBlur={(e) => handleIntervalChange(e.target.value)}
          className="w-32"
        />
      </div>

      {/* 手動同期 */}
      <div className="flex items-center gap-4">
        <Button
          onClick={handleTriggerSync}
          disabled={!config.enabled || status.state === "syncing"}
        >
          {status.state === "syncing" ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          今すぐ同期
        </Button>
        <StateIndicator state={status.state} />
      </div>

      {/* スキーマバージョン不一致の通知 */}
      {(status.versionMismatches ?? []).length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div className="space-y-1 text-sm text-amber-800">
              {status.versionMismatches.some(
                (mismatch) => mismatch.remoteIsNewer
              ) ? (
                <p className="font-medium">
                  他のPCがより新しいバージョンのアプリを使用しています。このPCのアプリを更新するまで、そのPCとの同期は保留されます。
                </p>
              ) : (
                <p className="font-medium">
                  他のPCが古いバージョンのアプリを使用しています。そのPCのアプリが更新されるまで、そのPCとの同期は保留されます。
                </p>
              )}
              <p className="text-xs text-amber-700">
                保留中: {status.versionMismatches.length}台
                （このPC以外のデータが失われることはありません）
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ステータス */}
      <div className="rounded-lg border p-4">
        <h3 className="mb-3 text-sm font-medium">同期ステータス</h3>
        <dl className="text-sm">
          <div className="flex justify-between py-1">
            <dt className="text-muted-foreground">最終同期</dt>
            <dd>
              {status.lastSyncTime
                ? new Date(status.lastSyncTime).toLocaleString("ja-JP")
                : "なし"}
            </dd>
          </div>
          <div className="flex justify-between py-1">
            <dt className="text-muted-foreground">同期回数</dt>
            <dd>{status.syncCount}</dd>
          </div>
          {status.lastError && (
            <div className="mt-2 rounded bg-red-50 p-2 text-xs text-red-700">
              {status.lastError}
            </div>
          )}
        </dl>
      </div>

      {/* クライアントID */}
      <div className="space-y-2">
        <Label>クライアントID</Label>
        <Input
          value={config.clientId || "未生成"}
          readOnly
          className="bg-muted font-mono text-xs"
        />
        <p className="text-muted-foreground text-xs">
          このPCを識別するための自動生成IDです
        </p>
      </div>
    </div>
  )
}
