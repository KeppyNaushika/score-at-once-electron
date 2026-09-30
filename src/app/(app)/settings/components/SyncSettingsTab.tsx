"use client"

import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  RefreshCw,
} from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { useSyncSettings } from "@/app/(app)/settings/hooks/useSyncSettings"
import { BetaBadge } from "@/components/common/BetaBadge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
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
import { Switch } from "@/components/ui/switch"
import { describeSyncWarnings } from "@/lib/shared/syncWarningMessages"

/**
 * 同期を使う人が、**使い始める前に**知っておくべきこと。
 *
 * どれも「知らないまま使うと、データが消えたように見える」たぐいの話なので、
 * 畳まずに置く（最初の {@link ALWAYS_VISIBLE_NOTE_COUNT} 件は必ず見える）。
 * 技術の言葉（版・主キー・親行）は使わない。読むのは教員で、直せるのは運用だけである。
 */
const SYNC_NOTES: { title: string; body: string }[] = [
  {
    title: "この機能はまだ beta です",
    body: "これから仕様が変わることがあります。大切なデータは、同期とは別に必ずバックアップを取ってください。",
  },
  {
    title: "削除はすべてのPCに伝わり、取り消せません",
    body: "どれか1台で消したものは、他のPCからも消えます。元に戻す操作はありません。",
  },
  {
    title: "消したものにぶら下がっていたデータは、表示から外れます",
    body: "消えてはいません。元になるものが同じものとして作り直されれば、そのまま表示に戻ります。",
  },
  {
    title:
      "同期フォルダにあるのは同期のための控えで、バックアップではありません",
    body: "同期フォルダの中身から、一括採点のデータを元に戻すことはできません。バックアップは別に取ってください。",
  },
  {
    title: "すべてのPCで、同じバージョンの一括採点を使ってください",
    body: "バージョンの違うPCとは同期しません。データが失われることはありませんが、そのPCとのあいだで変更が届かなくなります。",
  },
  {
    title: "アプリ本体は共有ドライブに置かず、各PCに入れてください",
    body: "共有ドライブから起動すると、ほとんど動きません。共有するのはデータだけです。",
  },
  {
    title: "別々のPCで同じ名前のものを作ると、片方が隠れることがあります",
    body: "隠れた方も消えてはいません。名前を変えて重なりを解けば、隠れていた方が表示に戻ります。",
  },
]

/** 畳んでも必ず見えている注意事項の数。残りは開いたときだけ出す */
const ALWAYS_VISIBLE_NOTE_COUNT = 4

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
      return <span className="text-sm text-muted-foreground">無効</span>
  }
}

/**
 * 同期を使う前に読む注意事項。**常に画面にある。**
 *
 * 同期のトーストは流れて消えるうえ、起きてからしか出ない。起きる前に読める場所が
 * 要る。全部を畳むと読まれないので、頭の数件は畳まない。
 */
function SyncNotes() {
  const [showsAll, setShowsAll] = useState(false)
  const visibleNotes = showsAll
    ? SYNC_NOTES
    : SYNC_NOTES.slice(0, ALWAYS_VISIBLE_NOTE_COUNT)
  const hiddenCount = SYNC_NOTES.length - ALWAYS_VISIBLE_NOTE_COUNT

  return (
    <Alert>
      <AlertCircle className="h-4 w-4" />
      <AlertTitle className="flex items-center gap-2">
        同期を使う前に
        <BetaBadge />
      </AlertTitle>
      <AlertDescription>
        <ul className="mt-2 space-y-2 text-sm">
          {visibleNotes.map((note) => (
            <li key={note.title}>
              <span className="font-medium">{note.title}</span>
              <span className="text-muted-foreground">。{note.body}</span>
            </li>
          ))}
        </ul>
        {hiddenCount > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-2 h-auto px-2 py-1"
            onClick={() => setShowsAll(!showsAll)}
          >
            {showsAll ? (
              <ChevronDown className="mr-1 h-4 w-4" />
            ) : (
              <ChevronRight className="mr-1 h-4 w-4" />
            )}
            {showsAll
              ? "残りを畳む"
              : `残りの注意事項を見る（${hiddenCount}件）`}
          </Button>
        )}
      </AlertDescription>
    </Alert>
  )
}

/**
 * 直近の同期が出した注意を、**消えない形で**並べる。
 *
 * 同じ注意は原因が続くかぎり毎回出るので、トーストだけだと流れて消えたあと
 * 確かめる場所が無くなる。ここが確かめる場所。履歴ではなく直近1回ぶんだけを出す
 * （溜めると、直っていないのか昔の話なのかが読めなくなる）。
 *
 * 言い換えられなかった注意は原文のまま出す。知らない注意を黙って捨てない。
 */
function SyncWarningList({ warnings }: { warnings: string[] }) {
  const [showsOriginals, setShowsOriginals] = useState(false)
  const notices = describeSyncWarnings(warnings)
  if (notices.length === 0) return null

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
      <h3 className="mb-2 flex items-center gap-2 text-sm font-medium text-amber-900">
        <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
        直近の同期で出た注意
      </h3>
      <ul className="space-y-2 text-sm text-amber-800">
        {notices.map((notice) => (
          <li key={notice.key}>
            {notice.message}
            {notice.count > 1 && (
              <span className="text-amber-700">（{notice.count}件）</span>
            )}
            {!notice.translated && (
              <span className="ml-1 text-xs text-amber-700">
                （このPCでは言い換えられない知らせです。そのまま表示しています）
              </span>
            )}
          </li>
        ))}
      </ul>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="mt-2 h-auto px-2 py-1 text-amber-900"
        onClick={() => setShowsOriginals(!showsOriginals)}
      >
        {showsOriginals ? (
          <ChevronDown className="mr-1 h-4 w-4" />
        ) : (
          <ChevronRight className="mr-1 h-4 w-4" />
        )}
        {showsOriginals ? "詳しい内容を畳む" : "詳しい内容を見る"}
      </Button>
      {showsOriginals && (
        <pre className="mt-2 max-h-60 overflow-auto rounded bg-amber-100 p-2 text-xs whitespace-pre-wrap text-amber-900">
          {warnings.join("\n")}
        </pre>
      )}
    </div>
  )
}

export function SyncSettingsTab() {
  const { config, syncPath, status, isLoading, updateConfig, triggerSync } =
    useSyncSettings()
  const [isDisableConfirmOpen, setIsDisableConfirmOpen] = useState(false)

  if (isLoading || !config) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner className="size-6 text-muted-foreground" />
      </div>
    )
  }

  /**
   * 同期の入切。**文面は実際の処理に合わせる。**
   *
   * 切るときは `updateSyncConfig` が、最後にもう一度同期してから止め、このPCの控えを
   * 共有フォルダへ書き戻して控えを消す。最後の同期は取り込みも行うので、同期フォルダに
   * 届いている他のPCの変更はここで入る。一方、このPCの変更が他のPCへ渡るのは、
   * **そのPCが次に同期したとき**である。だから「他のPCにすぐ反映される」とは書かない。
   */
  const handleToggleEnabled = (enabled: boolean) => {
    if (!enabled) {
      setIsDisableConfirmOpen(true)
      return
    }
    void applyEnabled(true)
  }

  const applyEnabled = async (enabled: boolean) => {
    try {
      await updateConfig({ enabled })
      toast.success(
        enabled
          ? "同期を始めました（このPCで使うデータの控えを用意しました）"
          : "同期をやめました（最後の同期のあと、このPCのデータを共有フォルダへ書き戻しました）"
      )
    } catch (error) {
      toast.error("設定を保存できませんでした", {
        description: error instanceof Error ? error.message : undefined,
      })
    }
  }

  const handleIntervalChange = async (value: string) => {
    const seconds = parseInt(value, 10)
    if (isNaN(seconds) || seconds < 5) return
    await updateConfig({ intervalMs: seconds * 1000 })
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
          データディレクトリ内の同期フォルダを介して複数PCのデータを同期します。
        </p>
      </div>

      <SyncNotes />

      {/* 同期の有効/無効 */}
      <div className="flex items-center justify-between rounded-lg border p-4">
        <div className="space-y-0.5">
          <Label className="flex items-center gap-2 text-base">
            NAS同期
            <BetaBadge />
          </Label>
          <p className="text-sm text-muted-foreground">
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
        <p className="text-xs text-muted-foreground">
          データディレクトリ内に自動作成されます。ここにあるのは同期のための控えで、バックアップではありません。
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
            <Spinner className="mr-2" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          今すぐ同期
        </Button>
        <StateIndicator state={status.state} />
      </div>

      <AlertDialog
        open={isDisableConfirmOpen}
        onOpenChange={setIsDisableConfirmOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>同期をやめますか？</AlertDialogTitle>
            <AlertDialogDescription className="whitespace-pre-line">
              {
                "最後にもう一度同期してから、このPCのデータを共有フォルダへ書き戻し、このPCに置いていた控えを削除します。共有フォルダのデータは、このPCの内容で置き換わります。\nこのPCの変更が他のPCに現れるのは、そのPCが次に同期したときです。"
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={() => void applyEnabled(false)}>
              同期をやめる
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
