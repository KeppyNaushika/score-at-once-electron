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
 * 同期を使う人への注意事項。**段ごとに役割を決めて並べる。**
 *
 * 現象を思いついた順に並べると、何を決めればよいのか読み取れない。段の役割は次の4つで、
 * この順に置く。どの段も畳まず、常に見えるようにする。
 *
 * 1. **この機能について** —— 何をする機能か、何を保証しないか
 * 2. **元に戻せないこと** —— 取り返しがつかない操作
 * 3. **使い始める前に** —— 満たしていないと使えない条件
 * 4. **使っているあいだ** —— そういう仕様だと知っておくこと
 *
 * 技術の言葉（版・主キー・親行・畳み）は使わない。利用者はデータの作りを知らないので、
 * **画面で見えるもの（試験・採点結果・タグ）を主語にする**。
 */
const SYNC_NOTICE_SECTIONS: { heading: string; items: string[] }[] = [
  {
    heading: "この機能について",
    items: [
      "共有フォルダを通して、複数のPCで同じデータを使うための機能です。採点を分担するときに使います。",
      "まだ beta です。これから動きが変わることがあり、不具合が残っている可能性もあります。",
      "採点したデータは、同期とは別に、ご自身でもバックアップを取ってください。共有フォルダに置かれるのはPC同士がやりとりするための控えだけで、そこから一括採点のデータを元に戻すことはできません。",
    ],
  },
  {
    heading: "元に戻せないこと",
    items: [
      "あるPCで消したものは、他のPCからも消えます。消す前に、他の先生の分も消えてよいか確かめてください。",
      "消したものを元に戻す操作はありません。試験を消すと、その試験の採点結果も見られなくなります。同じ名前の試験を作り直しても、前の採点結果は戻りません。",
      "元に戻したいときは、消す前に書き出しておいたファイルから取り込み直してください。",
    ],
  },
  {
    heading: "使い始める前に",
    items: [
      "一括採点そのものは、PCごとに入れてください。共有フォルダに置いた一括採点を全員で開く使い方はできません。共有するのはデータだけです。",
      "同期するPCは、すべて同じバージョンの一括採点にしてください。バージョンが違うPCとは、やりとりを行いません。",
    ],
  },
  {
    heading: "使っているあいだ",
    items: [
      "直した内容が他のPCに現れるのは、そのPCが次に同期したときです。すぐには映りません。",
      "別々の設問を採点していれば、どちらの採点も残ります。同じものを2人が同時に直したときだけ、あとに保存した方の内容が残ります。",
      "別々のPCで同じ名前のタグを作ると、タグは1つにまとまって表示されます。名前を変えて分ければ、元の2つに戻ります。",
    ],
  },
]

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
 * 同期を使う人への注意事項。**全部が常に画面にある（畳まない）。**
 *
 * 同期のトーストは流れて消えるうえ、起きてからしか出ない。起きる前に読める場所が要る。
 * 畳むと読まれないので、畳む仕掛けは置かない。
 */
function SyncNotes() {
  return (
    <Alert>
      <AlertCircle className="h-4 w-4" />
      <AlertTitle className="flex items-center gap-2">
        同期についてのご注意
        <BetaBadge />
      </AlertTitle>
      <AlertDescription>
        <div className="mt-2 space-y-3 text-sm">
          {SYNC_NOTICE_SECTIONS.map((section) => (
            <section key={section.heading}>
              <h4 className="font-medium">{section.heading}</h4>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
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
