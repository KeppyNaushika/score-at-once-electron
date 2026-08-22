"use client"

import { useRouter } from "next/navigation"
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react"

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

export interface DirtyDetail {
  label: string
  count: number
}

/**
 * 確認ダイアログのあいだ保留しておく「やること」。
 *
 * 行き先の href だけを覚えていたときは、確認後に復元できるのが `router.push` に
 * 限られていた。**履歴の行き来（戻る・進む・履歴の n 番目へ）は行き先を持たない**
 * ——どこへ着くかを決めるのは履歴であってアプリではない——ので、href では表せない。
 * 押す・戻る・進むを同じダイアログに載せるために、保留するものを行き先から行為へ
 * 広げている。
 *
 * 行き来の中身をここに書かず関数で受け取るのは、`router.back()` なのか Electron の
 * セッション履歴への `goToIndex` なのかを、このコンテキストが知らずに済ませるため。
 */
type NavigationIntent =
  { kind: "push"; href: string } | { kind: "traverse"; traverse: () => void }

interface NavigationGuardContextType {
  isDirty: boolean
  setNavigationGuard: (isDirty: boolean, details?: DirtyDetail[]) => void
  clearNavigationGuard: () => void
  guardedNavigate: (href: string) => void
  requestNavigation: (href: string) => boolean
  /**
   * 履歴を行き来する操作をガードへ通す（戻る・進む・履歴の n 番目へ）。
   * 書きかけがあれば確認を挟み、「離れる」を選んだときに `traverse` を実行する。
   */
  guardedTraverse: (traverse: () => void) => void
}

const NavigationGuardContext = createContext<NavigationGuardContextType>({
  isDirty: false,
  setNavigationGuard: () => {},
  clearNavigationGuard: () => {},
  guardedNavigate: () => {},
  requestNavigation: () => true,
  guardedTraverse: (traverse) => traverse(),
})

/** ナビゲーションガードコンテキストから未保存確認・遷移制御の機能を取得するフック */
export function useNavigationGuardContext() {
  return useContext(NavigationGuardContext)
}

/** 未保存データがある場合の離脱確認ダイアログを管理するプロバイダー */
export function NavigationGuardProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [isDirty, setIsDirty] = useState(false)
  const [details, setDetails] = useState<DirtyDetail[]>([])
  const [pendingNavigation, setPendingNavigation] =
    useState<NavigationIntent | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const isDirtyRef = useRef(false)

  const setNavigationGuard = useCallback(
    (dirty: boolean, newDetails?: DirtyDetail[]) => {
      setIsDirty(dirty)
      isDirtyRef.current = dirty
      if (newDetails) {
        setDetails(newDetails)
      }
    },
    []
  )

  const clearNavigationGuard = useCallback(() => {
    setIsDirty(false)
    isDirtyRef.current = false
    setDetails([])
  }, [])

  const runNavigation = useCallback(
    (intent: NavigationIntent) => {
      switch (intent.kind) {
        case "push":
          router.push(intent.href)
          break
        case "traverse":
          intent.traverse()
          break
      }
    },
    [router]
  )

  /**
   * 「これをやってよいか」を訊く。よければ true を返すので、
   * **実行するのは呼び出し側**（リンクの既定動作をそのまま通す `GuardedLink` 用）。
   */
  const requestNavigationIntent = useCallback(
    (intent: NavigationIntent): boolean => {
      if (isDirtyRef.current) {
        setPendingNavigation(intent)
        setDialogOpen(true)
        return false
      }
      return true
    },
    []
  )

  /** 訊いたうえで**こちらが実行する**。行き先へのリンクを持たないボタン用 */
  const guardedNavigateIntent = useCallback(
    (intent: NavigationIntent) => {
      if (requestNavigationIntent(intent)) {
        runNavigation(intent)
      }
    },
    [requestNavigationIntent, runNavigation]
  )

  const guardedNavigate = useCallback(
    (href: string) => {
      guardedNavigateIntent({ kind: "push", href })
    },
    [guardedNavigateIntent]
  )

  const requestNavigation = useCallback(
    (href: string): boolean => requestNavigationIntent({ kind: "push", href }),
    [requestNavigationIntent]
  )

  const guardedTraverse = useCallback(
    (traverse: () => void) => {
      guardedNavigateIntent({ kind: "traverse", traverse })
    },
    [guardedNavigateIntent]
  )

  // beforeunload handler
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirtyRef.current) {
        e.preventDefault()
      }
    }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [])

  const handleLeave = useCallback(() => {
    setDialogOpen(false)
    if (pendingNavigation) {
      clearNavigationGuard()
      runNavigation(pendingNavigation)
      setPendingNavigation(null)
    }
  }, [pendingNavigation, clearNavigationGuard, runNavigation])

  const handleStay = useCallback(() => {
    setDialogOpen(false)
    setPendingNavigation(null)
  }, [])

  return (
    <NavigationGuardContext.Provider
      value={{
        isDirty,
        setNavigationGuard,
        clearNavigationGuard,
        guardedNavigate,
        requestNavigation,
        guardedTraverse,
      }}
    >
      {children}
      <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>未保存のデータがあります</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                {details.length > 0 && (
                  <ul className="my-2 list-inside list-disc">
                    {details
                      .filter((detail) => detail.count > 0)
                      .map((detail) => (
                        <li key={detail.label}>
                          {detail.label}: {detail.count}件
                        </li>
                      ))}
                  </ul>
                )}
                <p>このまま画面を離れるとこれらのデータは失われます。</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleStay}>戻る</AlertDialogCancel>
            <AlertDialogAction onClick={handleLeave}>離れる</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </NavigationGuardContext.Provider>
  )
}
