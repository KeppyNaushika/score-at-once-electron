import { useEffect, useState } from "react"
import { toast } from "sonner"

/**
 * web 版で、データを置いているブラウザの保存領域（OPFS）の状態。
 *
 * IPC ではなく画面からブラウザの `navigator.storage` を直に読む（DB の行ではないので
 * `src/queries/` のキャッシュには載せない）。データは Worker が OPFS に置くが、保存領域は
 * オリジンで1つなので画面から見ても同じものを指す。
 */
interface BrowserStorageStatus {
  /**
   * ブラウザが容量に困ったときにも消さない約束（`persist()`）を得ているか。
   * 得ていなければ、ブラウザは知らせずに丸ごと消しうる
   */
  persisted: boolean
  /** 使っている量（バイト）。ブラウザが返す見積もり */
  usage: number
  /** 使える上限（バイト）。ブラウザが返す見積もり */
  quota: number
}

const readBrowserStorageStatus = async (): Promise<BrowserStorageStatus> => {
  const [persisted, estimate] = await Promise.all([
    navigator.storage.persisted(),
    navigator.storage.estimate(),
  ])
  return {
    persisted,
    usage: estimate.usage ?? 0,
    quota: estimate.quota ?? 0,
  }
}

export function useBrowserStorageStatus() {
  const [status, setStatus] = useState<BrowserStorageStatus | null>(null)
  const [isRequesting, setIsRequesting] = useState(false)

  useEffect(() => {
    let isCurrent = true
    void readBrowserStorageStatus().then((nextStatus) => {
      if (isCurrent) setStatus(nextStatus)
    })
    return () => {
      isCurrent = false
    }
  }, [])

  /**
   * 消さない約束をブラウザに頼む。Chrome / Edge は尋ねずに、そのサイトの使われ方
   * （ブックマーク・アプリとしてのインストールなど）から決める。断られても失敗にはしない。
   * 断られると画面の表示は変わらないので、押したことが伝わるよう知らせる
   */
  const requestPersistence = async () => {
    setIsRequesting(true)
    try {
      const persisted = await navigator.storage.persist()
      setStatus(await readBrowserStorageStatus())
      if (!persisted) {
        toast.info("ブラウザは今は保護しないと答えました", {
          description:
            "このサイトをブックマークするか、アプリとしてインストールしてから、もう一度頼んでください。",
        })
      }
    } finally {
      setIsRequesting(false)
    }
  }

  return { status, isRequesting, requestPersistence }
}
