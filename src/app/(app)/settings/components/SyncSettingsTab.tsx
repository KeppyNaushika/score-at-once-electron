"use client"

import { AlertCircle, CheckCircle2, RefreshCw, RotateCw } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { useSyncSettings } from "@/app/(app)/settings/hooks/useSyncSettings"
import { BetaBadge } from "@/components/common/BetaBadge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import type { SharedFolderConnectAction } from "@/electron-src/lib/sync/storageModeService"
import type { SharedProfile } from "@/electron-src/lib/sync/types"

import {
  type InspectedSharedFolder,
  SharedFolderConnectDialog,
} from "./SharedFolderConnectDialog"
import { StorageProfileList } from "./StorageProfileList"
import { SyncNotes } from "./SyncNotes"
import { SyncWarningList } from "./SyncWarningList"

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
          <Spinner />
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
      return (
        <span className="text-sm text-muted-foreground">
          同期していません（共有モードで起動したときだけ同期します）
        </span>
      )
  }
}

export function SyncSettingsTab() {
  const {
    config,
    running,
    restartPending,
    status,
    isLoading,
    updateTiming,
    triggerSync,
    connectSharedFolder,
    isConnecting,
    selectStartupStorage,
    migrateProfileToLocal,
    isMigratingToLocal,
    chooseSharedFolder,
    inspectSharedFolder,
    relaunch,
  } = useSyncSettings()
  const [inspected, setInspected] = useState<InspectedSharedFolder | null>(null)
  const [migrationSource, setMigrationSource] = useState<SharedProfile | null>(
    null
  )
  const [isRestartPromptOpen, setIsRestartPromptOpen] = useState(false)

  if (isLoading || !config || !running) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner className="size-6 text-muted-foreground" />
      </div>
    )
  }

  const isSharedRunning = running.mode === "shared"

  /** 共有フォルダを選んで見る。共有できないフォルダなら理由を出して終わる */
  const handleAddSharedFolder = async () => {
    const sharedFolderPath = await chooseSharedFolder()
    if (sharedFolderPath === null) return
    const inspection = await inspectSharedFolder(sharedFolderPath)
    if (inspection.kind === "unreachable" || inspection.kind === "unusable") {
      toast.error("この共有フォルダは使えません", {
        description: inspection.reason,
      })
      return
    }
    setInspected({ sharedFolderPath, inspection })
  }

  const handleConnect = async (action: SharedFolderConnectAction) => {
    if (inspected === null) return
    await connectSharedFolder({
      sharedFolderPath: inspected.sharedFolderPath,
      action,
    })
    setInspected(null)
    setIsRestartPromptOpen(true)
  }

  const handleSelectStartup = async (
    selection: { mode: "local" } | { mode: "shared"; sharedFolderId: string }
  ) => {
    await selectStartupStorage(selection)
    setIsRestartPromptOpen(true)
  }

  const handleMigrateToLocal = async () => {
    if (migrationSource === null) return
    await migrateProfileToLocal(migrationSource.sharedFolderId)
    setMigrationSource(null)
    setIsRestartPromptOpen(true)
  }

  const handleIntervalChange = async (value: string) => {
    const seconds = parseInt(value, 10)
    if (isNaN(seconds) || seconds < 5) return
    await updateTiming(seconds * 1000)
  }

  const handleTriggerSync = async () => {
    try {
      await triggerSync()
      toast.success("同期が完了しました")
    } catch (error) {
      toast.error("同期に失敗しました", {
        description: error instanceof Error ? error.message : undefined,
      })
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          同期設定
          <BetaBadge />
        </h2>
        <p className="text-sm text-muted-foreground">
          ローカルモードと共有モードを切り替えます。共有モードでは、共有フォルダを介して複数のPCのデータを同期します。
        </p>
      </div>

      <SyncNotes />

      {restartPending && (
        <div className="flex items-center justify-between gap-4 rounded-lg border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm text-amber-800">
            起動の設定を変えました。再起動すると切り替わります。
          </p>
          <Button size="sm" onClick={() => void relaunch()}>
            <RotateCw className="mr-2 h-4 w-4" />
            今すぐ再起動
          </Button>
        </div>
      )}

      {/* モードと共有プロファイル */}
      <div className="space-y-2">
        <Label className="text-base">起動するデータ</Label>
        <p className="text-sm text-muted-foreground">
          ローカルモードと共有モードは別々のデータです。切り替えてもデータは行き来しません。切り替えは再起動したときに効きます。
        </p>
        <StorageProfileList
          nextMode={config.mode}
          nextSharedFolderId={config.activeSharedFolderId}
          runningMode={running.mode}
          runningSharedFolderId={running.sharedFolder?.sharedFolderId ?? null}
          profiles={config.sharedProfiles}
          isBusy={isConnecting || isMigratingToLocal}
          onSelectLocal={() => void handleSelectStartup({ mode: "local" })}
          onSelectProfile={(sharedFolderId) =>
            void handleSelectStartup({ mode: "shared", sharedFolderId })
          }
          onMigrateProfileToLocal={setMigrationSource}
          onAddSharedFolder={() => void handleAddSharedFolder()}
        />
      </div>

      {/* いま使っている置き場（読み取り専用） */}
      <div className="space-y-2">
        <Label>いま使っているデータの置き場</Label>
        <Input
          value={running.databasePath}
          readOnly
          className="bg-muted font-mono text-xs"
        />
        <Input
          value={running.sharedFilesDirectory}
          readOnly
          className="bg-muted font-mono text-xs"
        />
        <p className="text-xs text-muted-foreground">
          上がデータベース、下が答案・模範解答などの画像の置き場です。共有モードの共有フォルダにあるのは同期のための写しで、バックアップではありません。
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
          disabled={!isSharedRunning || status.state === "syncing"}
        >
          {status.state === "syncing" ? (
            <Spinner className="mr-2" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          今すぐ同期
        </Button>
        <StateIndicator state={status.state} />
      </div>

      <SharedFolderConnectDialog
        inspected={inspected}
        knownSharedFolderIds={config.sharedProfiles.map(
          (profile) => profile.sharedFolderId
        )}
        isConnecting={isConnecting}
        onConnect={(action) => void handleConnect(action)}
        onClose={() => setInspected(null)}
      />

      <AlertDialog
        open={migrationSource !== null}
        onOpenChange={(open) => {
          if (!open && !isMigratingToLocal) setMigrationSource(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ローカルモードへ移行しますか？</AlertDialogTitle>
            <AlertDialogDescription className="break-all whitespace-pre-line">
              {`${migrationSource?.sharedFolderPath ?? ""}\n\nこの共有プロファイルのデータ（データベースと画像）を、このPCのローカルモードへ写します。移せるのは、ローカルモードにまだデータが無いときだけです。共有フォルダには何も書きません。\n統合したい場合は、アーカイブの書き出しと取り込みを使ってください。`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isMigratingToLocal}>
              やめる
            </AlertDialogCancel>
            <Button
              disabled={isMigratingToLocal}
              onClick={() => void handleMigrateToLocal()}
            >
              {isMigratingToLocal && <Spinner className="mr-2" />}
              移行する
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={isRestartPromptOpen}
        onOpenChange={setIsRestartPromptOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>再起動して切り替えますか？</AlertDialogTitle>
            <AlertDialogDescription>
              起動するデータの設定を保存しました。切り替わるのは再起動したときです。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>あとで</AlertDialogCancel>
            <AlertDialogAction onClick={() => void relaunch()}>
              今すぐ再起動
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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

      {/* 直近の同期が出した注意（トーストと違って消えない） */}
      <SyncWarningList warnings={status.lastWarnings ?? []} />

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
        <p className="text-xs text-muted-foreground">
          このPCを識別するための自動生成IDです
        </p>
      </div>
    </div>
  )
}
