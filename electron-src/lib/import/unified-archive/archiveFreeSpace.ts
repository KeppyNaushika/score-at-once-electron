/**
 * 統合アーカイブ（.sao）を展開する先の空きを測る
 *
 * デスクトップ版と web 版で同じコードが動く。
 *
 * - web 版（Worker の中）: `navigator.storage.estimate()` の割り当てと使用量の差。展開先は
 *   OPFS（そのオリジンの保存領域）の中なので、この残りが書ける上限になる。`navigator.storage` は
 *   Worker でも使える（StorageManager は Window と Worker の両方に出ている）
 * - デスクトップ版: 展開先のディスクの空き（`fs/promises` の `statfs`）
 *
 * 測れなければ null を返す（呼び出し側は空きでは断らない。上限は `archiveZipReader.ts` が持つ）。
 */

/** 展開先の空き（バイト）。測れなければ null */
export async function measureAvailableBytes(
  directory: string
): Promise<number | null> {
  try {
    const storageManager =
      typeof navigator === "undefined" ? undefined : navigator.storage
    // Node（デスクトップ版の main）にも navigator はあるが、storage は無い
    if (storageManager && typeof storageManager.estimate === "function") {
      const { quota, usage } = await storageManager.estimate()
      if (quota === undefined || usage === undefined) return null
      return Math.max(0, quota - usage)
    }
    // web 版の `fs/promises`（OPFS）には statfs が無いので、ここへ来るのはデスクトップ版だけ
    const { statfs } = await import("fs/promises")
    if (typeof statfs !== "function") return null
    const stats = await statfs(directory)
    return stats.bavail * stats.bsize
  } catch {
    return null
  }
}
