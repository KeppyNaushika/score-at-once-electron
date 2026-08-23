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
import { toast } from "sonner"

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
 * セッション履歴への `goToIndex` なのか、Navigation API の `traverseTo` なのかを、
 * このコンテキストが知らずに済ませるため。
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

  /**
   * 「離れる」で自分から起こしている行き来の行き先。**着いたら（または失敗したら）
   * 必ず消す。**
   *
   * ガードを外してから再実行すれば素通りする、と考えたが**実測で否定された**。
   * `traverseTo` の `navigate` は同期でもマイクロタスクでもなく**マクロタスクの後**に
   * 飛ぶ（実測 1〜3ms）。その隙に React が再描画して画面側が
   * `setNavigationGuard(true)` を打ち直すと、再実行が自分の確認に捕まって
   * `AbortError` で消える —— 利用者から見れば「離れるを押したのに何も起きない」。
   *
   * だから外れていることに頼らず、**この行き先だけは通す**と名指しする。
   * 残り続ける印にしないために、消す道を2本持つ（`navigate` が来たときと、
   * 行き来が決着したとき）。印が残ったときの害も「その1つのエントリへの行き来が
   * 1回だけ確認を素通りする」に留まり、次の戻るを丸ごと食う類のものにはならない。
   */
  const replayingKeyRef = useRef<string | null>(null)

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

  /**
   * 戻る・進む（マウスの第4/第5ボタン）を、**動く前に**止める。
   *
   * ここが `popstate` ではなく Navigation API なのには理由がある。`popstate` は
   * **遷移が終わってから**飛ぶので、そこで出す確認は「もう消えたデータ」について
   * の確認になる。かつては Next より先に購読して握り潰し、履歴を元へ引き戻して
   * いたが、**引き戻しがあるせいで穴が2つ**あった —— 引き戻し中の印が残ると次の
   * 戻るを黙って食い、履歴の位置の写しがずれると1つ手前へ飛ばしていた。
   *
   * `navigate` は**遷移の前**に飛び、`preventDefault()` で取り消せる。取り消せば
   * 何も動かないので（URL も Next も履歴も）、**引き戻すものが無い**。上の2つは
   * 直すのではなく、成り立たなくなる。
   *
   * 実機で確かめたこと（Electron 43＝Chrome 150）:
   *
   * - マウスの第4ボタンの戻るも同じ `navigate` を起こし、`preventDefault()` で
   *   止まる。**押下そのものが取り消しの権限を与える**ので、連打でも間を空けても
   *   止まる（content 層が mouseup で `GoBack()` を呼ぶ経路なので、キー入力を
   *   潰す形では止められない —— そちらを採らなかった理由でもある）
   * - 取り消すと `location.href` も Chromium のセッション履歴の位置も動かず、
   *   `popstate` も飛ばない。Next は最後まで何も知らない
   *
   * **3つ、通す道がある。**
   *
   * 1. `navigationType` が `traverse` でないもの。押す・置き換えるは
   *    `GuardedLink` と `guardedNavigate` が既に見ている。ここで拾うと、
   *    **Next が行き来のあとに自分で打つ `replace`** まで捕まえてしまう
   * 2. `event.cancelable` が false のもの。**取り消せないのに `preventDefault()`
   *    を呼んでも例外は出ず、黙って遷移する**ので、呼ぶ前に見る。false になるのは
   *    (a) 別の文書への行き来（履歴の先頭＝ログイン前まで戻る場合だけ。
   *    アプリ内の遷移はすべて同じ文書なので通常は起こらない）と、(b) 画面に
   *    触っていない状態で main 側から `goBack()` を呼んだとき。後者はアプリの
   *    履歴ボタン経由だが、そちらは `guardedTraverse` が先に確認を出している
   * 3. 書きかけが無いとき
   *
   * **「離れる」の再実行は `traverseTo`。** 取り消した時点で何も動いていないので、
   * 行き先を `destination.key` で覚えておき、そこへ改めて行く。`history.go(delta)`
   * ではない —— **取り消したあとの `go` は黙って何もしない**ことがある（多段の
   * 行き来を取り消したあとで実測。1.2秒後・4秒後・8秒後のいずれでも落ちた）。
   * 履歴一覧から数歩戻る操作もこの経路に来るので、多段が表せないと困る。
   */
  useEffect(() => {
    // Chromium 以外（`next dev` を素のブラウザで開いたとき）には無い
    if (typeof window.navigation === "undefined") return
    const navigation = window.navigation

    const handleNavigate = (event: NavigateEvent) => {
      if (event.navigationType !== "traverse") return
      if (event.destination.key === replayingKeyRef.current) {
        // 「離れる」で自分から起こしたもの。ここで止めると同じ確認が無限に出る
        replayingKeyRef.current = null
        return
      }
      if (!isDirtyRef.current) return
      // 取り消せない行き来は止められない。`preventDefault()` は例外も投げず、
      // 黙って遷移する。ここで諦めるのが唯一できることで、`beforeunload` が
      // 拾えるのは文書ごと消える場合だけ
      if (!event.cancelable) return

      event.preventDefault()
      const destinationKey = event.destination.key
      setPendingNavigation({
        kind: "traverse",
        traverse: () => {
          replayingKeyRef.current = destinationKey
          const result = navigation.traverseTo(destinationKey)
          // 失敗は黙らせない。行き先が既に履歴から消えていれば
          // `InvalidStateError`、途中で捕まれば `AbortError` で**拒否される**
          //（例外は投げない）。拾わないと、押したのに何も起きない画面になる
          void result.committed?.then(
            () => {
              replayingKeyRef.current = null
            },
            () => {
              replayingKeyRef.current = null
              toast.error("前の画面へ戻れませんでした")
            }
          )
        },
      })
      setDialogOpen(true)
    }

    navigation.addEventListener("navigate", handleNavigate)
    return () => navigation.removeEventListener("navigate", handleNavigate)
  }, [])

  /**
   * 文書ごと消えるとき（窓を閉じる・再読み込み）。
   *
   * **`navigate` では拾えない。** あちらが見るのはこの文書の中の遷移だけで、
   * 別の文書への行き来は取り消せない（実機で確認済み）。ここが唯一の防波堤になる。
   */
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
      // 外してから実行する。ただし**外れていることには頼らない**
      //（`replayingKeyRef` の註釈のとおり、再実行の `navigate` が飛ぶ頃には
      //  画面側が打ち直している場合がある）
      clearNavigationGuard()
      runNavigation(pendingNavigation)
      setPendingNavigation(null)
    }
  }, [pendingNavigation, clearNavigationGuard, runNavigation])

  /**
   * 「戻る」を選んだ（＝いまの画面に留まる）。
   *
   * **何も動いていないので、何も戻さない。** 行き来は `navigate` の時点で
   * 取り消してあり、押すリンクは `GuardedLink` が既定動作を止めている。
   */
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
      {/* 閉じ方は「戻る」と「離れる」の2つだけではない（Escape でも閉じる）ので、
          閉じる道を1本にまとめて必ず `handleStay` を通す */}
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
