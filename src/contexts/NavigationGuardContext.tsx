"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { usePathname, useRouter } from "next/navigation"
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
import {
  goToHistoryIndexMutation,
  navigationStateQuery,
} from "@/queries/navigation"

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
  const pathname = usePathname()
  const queryClient = useQueryClient()
  const { mutate: goToHistoryIndex } = useMutation(goToHistoryIndexMutation())
  const [isDirty, setIsDirty] = useState(false)
  const [details, setDetails] = useState<DirtyDetail[]>([])
  const [pendingNavigation, setPendingNavigation] =
    useState<NavigationIntent | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const isDirtyRef = useRef(false)

  /**
   * いま居る履歴エントリの位置（Chromium のセッション履歴が持つ添字）。
   *
   * `popstate` は**移動が終わってから**飛び、どちらへ何歩動いたかを持たない。
   * 飛んだ後では「どこから来たか」が消えているので、直前の位置だけを手元に置く。
   * 位置そのものは持たず、遷移のたびに窓へ訊き直す（写しを増やさない）。
   */
  const currentHistoryIndexRef = useRef<number | null>(null)

  /**
   * 確認のあいだ預かっている `popstate`（横取りしたもの）。
   *
   * `state` が `null` の popstate と「預かっていない」を区別するために入れ物で包む。
   */
  const heldPopStateRef = useRef<{ state: unknown } | null>(null)

  /** 引き戻しのために自分で起こした移動。その `popstate` は Next へ渡さない */
  const isRollingBackRef = useRef(false)

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

  // 履歴の位置は窓が持っている。遷移のたびに引き直す
  useEffect(() => {
    let cancelled = false
    // 引き直すまでは「分からない」に倒す。古い位置を持ったまま横取りすると、
    // 引き戻し先を1つ間違える（そちらの方が履歴を壊す）
    currentHistoryIndexRef.current = null
    void queryClient
      .fetchQuery(navigationStateQuery())
      .then((navigationState) => {
        if (!cancelled) {
          currentHistoryIndexRef.current = navigationState.activeIndex
        }
      })
      // 履歴が引けない環境では位置を持たない（下の popstate は横取りしない）
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [pathname, queryClient])

  /**
   * 預かっていた `popstate` をもう一度流す（「離れる」を選んだとき）。
   *
   * ブラウザの履歴は既に行き先に居るので、動かすものは何も無い。要るのは
   * **Next へ知らせること**だけなので、横取りしたものをそのまま流し直す。
   * このときガードは外れているので、今度は素通りして Next の購読へ届く。
   */
  const replayHeldPopState = useCallback(() => {
    const held = heldPopStateRef.current
    heldPopStateRef.current = null
    if (!held) return
    window.dispatchEvent(new PopStateEvent("popstate", { state: held.state }))
  }, [])

  /**
   * 戻る・進む（Alt+← やマウスの第4/第5ボタン）をガードへ通す。
   *
   * **`popstate` は遷移が起きた後に飛ぶ。** ここで何もしなければ Next のルータが
   * 画面を差し替え、書きかけを抱えていたコンポーネントが外れる ── そのあとで確認を
   * 出しても、守るはずのデータはもう無い。だから **Next へ届く前に止める**。
   *
   * 止め方は `stopImmediatePropagation`。同じ `popstate` を Next も購読しているが、
   * 購読を始めるのは `AppRouter` の effect で、**このプロバイダはその子**（React は
   * 子の effect を先に流す）なので、購読はこちらが先に並ぶ。先に並んだ側が止めれば
   * Next の購読は呼ばれず、画面は動かない＝書きかけはそのまま残る。
   *
   * 動いてしまうのはブラウザの履歴だけなので、選ばれた方で辻褄を合わせる。
   *
   * - 「戻る」→ 元の位置へ引き戻す（`handleStay`）
   * - 「離れる」→ 預かった `popstate` を流し直し、Next に追いつかせる
   *
   * **書きかけが無いときは何もしない。** 素通しなので、履歴を往復させない。
   * `GuardedLink` のクリックは `popstate` を起こさないので、確認が二重に出ることもない。
   */
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (isRollingBackRef.current) {
        // 自分で起こした引き戻し。Next は行き先を知らないままなので渡さない
        isRollingBackRef.current = false
        event.stopImmediatePropagation()
        return
      }
      if (!isDirtyRef.current) return
      if (currentHistoryIndexRef.current === null) {
        // 引き戻す先が分からない。横取りすると URL と画面がずれたまま直せなく
        // なるので、ここは通す（この場合だけ確認が出ない）
        return
      }
      event.stopImmediatePropagation()
      heldPopStateRef.current = { state: event.state }
      setPendingNavigation({ kind: "traverse", traverse: replayHeldPopState })
      setDialogOpen(true)
    }
    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [replayHeldPopState])

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

    // `popstate` を横取りしていたときは、ブラウザだけが行き先へ動いている。
    // 元の位置へ引き戻す（この移動で飛ぶ `popstate` も Next へは渡さない）。
    // 何も預かっていなければ履歴は動いていないので、ここは何もしない
    const held = heldPopStateRef.current
    const cameFrom = currentHistoryIndexRef.current
    heldPopStateRef.current = null
    if (held && cameFrom !== null) {
      isRollingBackRef.current = true
      goToHistoryIndex(cameFrom)
    }
  }, [goToHistoryIndex])

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
      {/*
        閉じ方は「戻る」と「離れる」の2つだけではない（Escape でも閉じる）。
        閉じたのに引き戻さないと、横取りした `popstate` のぶん URL だけが行き先に
        残る。閉じる道を1本にまとめて、必ず `handleStay` を通す
      */}
      <AlertDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) handleStay()
        }}
      >
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
