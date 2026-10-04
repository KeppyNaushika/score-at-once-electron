"use client"

import { FolderPlus, HardDrive, Network } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { SharedProfile, StorageMode } from "@/electron-src/lib/sync/types"

interface StorageProfileListProps {
  /** 次の起動のモード */
  nextMode: StorageMode
  /** 次の起動で使う共有プロファイル */
  nextSharedFolderId: string | null
  /** いま動いているモード */
  runningMode: StorageMode
  /** いま動いている共有プロファイル */
  runningSharedFolderId: string | null
  profiles: SharedProfile[]
  isBusy: boolean
  onSelectLocal: () => void
  onSelectProfile: (sharedFolderId: string) => void
  onMigrateProfileToLocal: (profile: SharedProfile) => void
  onAddSharedFolder: () => void
}

/** 起動中・次回の印 */
function ProfileBadges({
  isRunning,
  isNext,
}: {
  isRunning: boolean
  isNext: boolean
}) {
  return (
    <span className="flex gap-1">
      {isRunning && <Badge>起動中</Badge>}
      {isNext && <Badge variant="outline">次回の起動</Badge>}
    </span>
  )
}

/**
 * ローカルモードと共有プロファイルの一覧。どれで起動するかを選ぶ。
 *
 * 選んでも、効くのは再起動したとき（根は起動時に1度だけ決まる）。
 */
export function StorageProfileList({
  nextMode,
  nextSharedFolderId,
  runningMode,
  runningSharedFolderId,
  profiles,
  isBusy,
  onSelectLocal,
  onSelectProfile,
  onMigrateProfileToLocal,
  onAddSharedFolder,
}: StorageProfileListProps) {
  const isLocalNext = nextMode === "local"
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
        <div className="flex min-w-0 items-start gap-3">
          <HardDrive className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2 font-medium">
              ローカルモード
              <ProfileBadges
                isRunning={runningMode === "local"}
                isNext={isLocalNext}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              このPCの data フォルダのデータだけを使います。同期はしません。
            </p>
          </div>
        </div>
        {!isLocalNext && (
          <Button
            variant="outline"
            size="sm"
            disabled={isBusy}
            onClick={onSelectLocal}
          >
            次回はこれで起動
          </Button>
        )}
      </div>

      {profiles.map((profile) => {
        const isNext =
          nextMode === "shared" && nextSharedFolderId === profile.sharedFolderId
        const isRunning =
          runningMode === "shared" &&
          runningSharedFolderId === profile.sharedFolderId
        return (
          <div
            key={profile.sharedFolderId}
            className="flex items-center justify-between gap-4 rounded-lg border p-4"
          >
            <div className="flex min-w-0 items-start gap-3">
              <Network className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2 font-medium">
                  共有モード
                  <ProfileBadges isRunning={isRunning} isNext={isNext} />
                </div>
                <p className="font-mono text-xs break-all">
                  {profile.sharedFolderPath}
                </p>
                <p className="font-mono text-xs text-muted-foreground">
                  識別ID: {profile.sharedFolderId}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-col gap-2">
              {!isNext && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isBusy}
                  onClick={() => onSelectProfile(profile.sharedFolderId)}
                >
                  次回はこれで起動
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                disabled={isBusy || runningMode === "local"}
                title={
                  runningMode === "local"
                    ? "共有モードで起動しているときに行えます"
                    : undefined
                }
                onClick={() => onMigrateProfileToLocal(profile)}
              >
                ローカルへ移行…
              </Button>
            </div>
          </div>
        )
      })}

      <Button variant="outline" disabled={isBusy} onClick={onAddSharedFolder}>
        <FolderPlus className="mr-2 h-4 w-4" />
        共有フォルダを追加…
      </Button>
    </div>
  )
}
