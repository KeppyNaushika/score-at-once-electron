"use client"

import { useCallback, useSyncExternalStore } from "react"

/**
 * localStorage の1つの鍵を購読する。
 *
 * **事前描画（Next.js）のサーバ側に localStorage は無い。** 初期値として直接読むと
 * ハイドレーションがずれるので、サーバのスナップショットは常に `null`（呼び手は既定値で
 * 描く）とし、マウント後に実際の値へ差し替える。`useKeyboardSettings` の
 * `modifierKeyLabel` と同じ型。
 *
 * **`storage` イベントは購読しない。** あのイベントは書いた document では発火せず、
 * 同一オリジンの**別の** document へ伝えるためのものである。この画面は
 * `electron-src/index.ts` が起動時に1つだけ作る BrowserWindow に閉じており
 * （書き出し・印刷用のオフスクリーンウィンドウは file:/data: で別オリジン、かつアプリの
 * 画面を読み込まない）、伝える相手はいつも同じ document の中にいる。よって伝達は
 * `setStoredText` からの通知だけで足りる。
 */

const listenersByStorageKey = new Map<string, Set<() => void>>()

function readStoredText(storageKey: string): string | null {
  try {
    return localStorage.getItem(storageKey)
  } catch {
    // localStorage が使えない環境では「保存が無い」とみなす
    return null
  }
}

function getServerStoredText(): null {
  return null
}

export function useLocalStorageText(storageKey: string | null): {
  storedText: string | null
  setStoredText: (storedText: string) => void
} {
  const subscribe = useCallback(
    (onStoredTextChange: () => void) => {
      if (storageKey === null) return () => {}

      const listeners =
        listenersByStorageKey.get(storageKey) ?? new Set<() => void>()
      listenersByStorageKey.set(storageKey, listeners)
      listeners.add(onStoredTextChange)

      return () => {
        listeners.delete(onStoredTextChange)
        if (listeners.size === 0) {
          listenersByStorageKey.delete(storageKey)
        }
      }
    },
    [storageKey]
  )

  const getStoredText = useCallback(
    () => (storageKey === null ? null : readStoredText(storageKey)),
    [storageKey]
  )

  const storedText = useSyncExternalStore(
    subscribe,
    getStoredText,
    getServerStoredText
  )

  const setStoredText = useCallback(
    (nextStoredText: string) => {
      if (storageKey === null) return
      try {
        localStorage.setItem(storageKey, nextStoredText)
      } catch {
        // 保存できない環境では画面の表示も変わらない（読みも同じ理由で失敗する）
      }
      const listeners = listenersByStorageKey.get(storageKey)
      if (!listeners) return
      // 通知の途中で購読が外れても走査が壊れないように写しを回す
      for (const listener of Array.from(listeners)) {
        listener()
      }
    },
    [storageKey]
  )

  return { storedText, setStoredText }
}
