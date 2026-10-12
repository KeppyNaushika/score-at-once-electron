"use client"

import { useEffect } from "react"
import { toast } from "sonner"

import {
  formatStorageBytes,
  isStorageNearlyFull,
} from "@/lib/browserStorageUsage"
import { isWebRuntime } from "@/lib/webRuntime"

/** 同じ知らせを2つ出さない（開発時の effect の2度呼び・画面の作り直し） */
const NOT_PERSISTED_TOAST_ID = "browser-storage-not-persisted"
const NEARLY_FULL_TOAST_ID = "browser-storage-nearly-full"

const SETTINGS_HINT = "設定 › ブラウザの保存領域 で状態を確かめられます。"

/**
 * web 版で、データを置いているブラウザの保存領域が危ういときに、開いた時点で1度知らせる。
 *
 * - **消さない約束が無い:** ブラウザは空き容量に困ると、知らせずにこのサイトのデータを
 *   丸ごと消しうる。開いたときに約束（`persist()`）を頼み、それでも得られなければ
 *   `.sao` での控えを勧める。Chrome / Edge は尋ねずにサイトの使われ方から決めるので、
 *   ここで頼んでも画面は遮らない
 * - **残りが少ない:** 書き込みが途中で止まる前に知らせる
 *
 * デスクトップ版では何もしない。描くものは無い。窓が開いている間ずっと置けるよう AppShell に置く。
 */
export function BrowserStorageNotifier() {
  useEffect(() => {
    if (!isWebRuntime()) return
    void checkBrowserStorage()
  }, [])

  return null
}

async function checkBrowserStorage(): Promise<void> {
  const [persisted, estimate] = await Promise.all([
    navigator.storage.persist(),
    navigator.storage.estimate(),
  ])
  if (!persisted) {
    toast.warning("ブラウザがデータを消すことがあります", {
      id: NOT_PERSISTED_TOAST_ID,
      description:
        "データはこのブラウザの中にだけ置かれています。このブラウザは空き容量が足りなくなると、" +
        "知らせずにデータを消すことがあります。データ書き出し（.sao）で控えを取っておいてください。\n" +
        SETTINGS_HINT,
      duration: Infinity,
      closeButton: true,
    })
  }
  const usage = estimate.usage ?? 0
  const quota = estimate.quota ?? 0
  if (isStorageNearlyFull(usage, quota)) {
    toast.warning("ブラウザの保存領域が残り少なくなっています", {
      id: NEARLY_FULL_TOAST_ID,
      description:
        `${formatStorageBytes(quota)} のうち ${formatStorageBytes(usage)} を使っています。` +
        "使わなくなった試験を .sao に書き出してから削除すると空きます。\n" +
        SETTINGS_HINT,
      duration: Infinity,
      closeButton: true,
    })
  }
}
