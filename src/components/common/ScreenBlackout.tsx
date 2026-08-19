"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Lock } from "lucide-react"
import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react"

import { useAuth } from "@/contexts/AuthContext"
import { parsePreference } from "@/lib/userPreferences"
import {
  fullScreenQuery,
  setFullScreenMutation,
  userPreferenceQuery,
} from "@/queries/settings"
import { userListQuery, verifyPasscodeMutation } from "@/queries/user"

const FADE_TIMEOUT_MS = 3000
/** 操作のたびに見張りを張り直さないための間隔（ms） */
const ACTIVITY_THROTTLE_MS = 1000

export function ScreenBlackout() {
  const { user } = useAuth()
  const [isBlackout, setIsBlackout] = useState(false)
  const [isLocked, setIsLocked] = useState(false)
  const [passcode, setPasscode] = useState("")
  const [error, setError] = useState("")
  const [uiVisible, setUiVisible] = useState(true)
  /** 最後に操作した時刻。無操作の見張りはこれが動いたら張り直す */
  const [lastActivityAt, setLastActivityAt] = useState(0)
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wasFullScreenBeforeRef = useRef(false)
  const passcodeRef = useRef("")
  /** 直近で「触った」と控えた時刻（間引き用） */
  const lastBumpRef = useRef(0)

  // 目隠しの設定は設定画面と同じキャッシュを読む。あちらで変えれば
  // ここも取り直されるので、変更を伝える自作イベントは要らない
  const { data: storedEnabled } = useQuery(
    userPreferenceQuery(user?.id, "screenBlackoutEnabled")
  )
  const { data: storedTimeoutMinutes } = useQuery(
    userPreferenceQuery(user?.id, "screenBlackoutTimeoutMinutes")
  )
  const { data: storedAutoFullScreen } = useQuery(
    userPreferenceQuery(user?.id, "screenBlackoutAutoFullScreen")
  )
  const blackoutEnabled = parsePreference(
    "screenBlackoutEnabled",
    storedEnabled ?? null
  )
  const timeoutMinutes = parsePreference(
    "screenBlackoutTimeoutMinutes",
    storedTimeoutMinutes ?? null
  )
  const autoFullScreen = parsePreference(
    "screenBlackoutAutoFullScreen",
    storedAutoFullScreen ?? null
  )

  // 操作者のパスコード種別（ログイン画面と同じ利用者一覧のキャッシュを共有する）
  const { data: users } = useQuery(userListQuery())
  const queryClient = useQueryClient()
  // `mutate` だけを取り出す。`useMutation` の戻り値は毎レンダー別物なので、
  // 依存に入れると下の useCallback が毎レンダー作り直され、それを依存に持つ
  // effect が毎レンダー走る。かつてその effect が設定を state へ蒔き直して
  // いたため、レンダーが止まらなくなった（実測: Maximum update depth exceeded）
  const { mutate: setFullScreen } = useMutation(setFullScreenMutation())
  const { mutate: verifyPasscodeMutate } = useMutation(verifyPasscodeMutation())
  const passcodeType = user?.id
    ? (users?.find((candidate) => candidate.id === user.id)?.passcodeType ??
      "none")
    : null

  // ロック対象は数字パスコード（4桁/6桁）のみ
  // 英数字パスコードはkeydownベースのIMEバイパスと相性が悪く、ロック解除不能になるリスクがある
  const hasDigitPasscode =
    passcodeType === "4digit" || passcodeType === "6digit"
  const maxLength = passcodeType === "4digit" ? 4 : 6

  // フェードUI制御
  const startFadeTimer = useCallback(() => {
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current)
    fadeTimerRef.current = setTimeout(() => {
      setUiVisible(false)
    }, FADE_TIMEOUT_MS)
  }, [])

  const showUi = useCallback(() => {
    setUiVisible(true)
    startFadeTimer()
  }, [startFadeTimer])

  const enterFullScreenIfNeeded = useCallback(async () => {
    if (!autoFullScreen) return
    // 暗転を解いたときに元へ戻せるよう、今が全画面かをその場で確かめる
    wasFullScreenBeforeRef.current =
      await queryClient.fetchQuery(fullScreenQuery())
    setFullScreen(true)
  }, [autoFullScreen, queryClient, setFullScreen])

  const restoreFullScreenIfNeeded = useCallback(() => {
    if (!autoFullScreen) return
    if (wasFullScreenBeforeRef.current) return
    setFullScreen(false)
  }, [autoFullScreen, setFullScreen])

  /**
   * 画面を暗転させる。無操作タイマーの発火と手動ロック（Ctrl/Cmd+L）で同じもの。
   *
   * **発火した時点の値を読む**（`useEffectEvent`）。閉じ込めると、タイマーを
   * 張ったときの `hasDigitPasscode` が固定され、利用者一覧が後から届く場合に
   * 「ロックなしで暗転する」ことになる。閉じ込めないために依存へ足すと、今度は
   * この関数を依存に持つ effect が毎レンダー走り、そこから設定の蒔き直しが
   * 起きて止まらなくなる（実測: Maximum update depth exceeded）。
   *
   * **施錠したかどうかを覚えるのは `isLocked` で、ここが唯一の決め手。** 解除側で
   * `hasDigitPasscode` を読み直してはいけない。この部品は `AuthGate` の外にあり、
   * 利用者一覧が届く前は false なので、起動直後に暗転すると開始時と解除時で
   * 判断が食い違い、**再読み込み以外に出口が無くなる**（指摘 #6）。
   */
  const blackoutNow = useEffectEvent(async () => {
    await enterFullScreenIfNeeded()
    setIsBlackout(true)
    if (hasDigitPasscode) {
      setIsLocked(true)
      setUiVisible(true)
      startFadeTimer()
    }
  })

  /**
   * 無操作の見張り。
   *
   * **タイマーは effect が持つ**（張る関数を外へ出さない）。以前は
   * `startTimer` を各所から呼んでいたが、そうすると「暗転の中身」を掴んだ
   * 関数が依存の連鎖に乗り、書き込みハンドルの同一性まで引きずっていた。
   * 見張り直しは「最後に触った時刻」が動いたことで表す。
   */
  useEffect(() => {
    if (!blackoutEnabled || isLocked || isBlackout) return

    const timer = setTimeout(
      () => {
        void blackoutNow()
      },
      timeoutMinutes * 60 * 1000
    )
    return () => clearTimeout(timer)
  }, [blackoutEnabled, timeoutMinutes, isLocked, isBlackout, lastActivityAt])

  const unlock = useCallback(() => {
    restoreFullScreenIfNeeded()
    setIsBlackout(false)
    setIsLocked(false)
    setUiVisible(true)
    passcodeRef.current = ""
    setPasscode("")
    setError("")
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current)
    // 見張りは `isBlackout` / `isLocked` が戻ったことで自動的に張り直る
  }, [restoreFullScreenIfNeeded])

  // 手動ロック（Ctrl/Cmd + L）。暗転の中身はタイマーと同じものを呼ぶ
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "l") {
        e.preventDefault()
        void blackoutNow()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  // ユーザー操作でタイマーリセット（ロック中は無視）
  useEffect(() => {
    if (!blackoutEnabled || isLocked) return

    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"]

    const handleActivity = () => {
      // **施錠したかどうかは `isLocked` だけで決める。** 目隠しを始めた瞬間の
      // `hasDigitPasscode` で施錠を決めたのに、解除側で読み直すと食い違う。
      // `ScreenBlackout` は `AuthGate` の外にあり、利用者一覧が届く前は
      // `hasDigitPasscode` が false なので、起動直後に Cmd+L を押すと
      // 「施錠されていないのに解除できない」状態になっていた
      // （docs/branch-review-findings.md #6）。
      if (isBlackout) {
        // ここへ来るのは施錠していないときだけ（施錠中はこの effect を張らない）
        unlock()
        return
      }
      // 見張りの張り直しは「触った」という事実だけで表す。連打で state が
      // 暴れないよう、間隔を空けて控える
      const now = Date.now()
      if (now - lastBumpRef.current < ACTIVITY_THROTTLE_MS) return
      lastBumpRef.current = now
      setLastActivityAt(now)
    }

    events.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true })
    })

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity)
      })
    }
  }, [blackoutEnabled, isBlackout, isLocked, unlock])

  // ロック画面でのユーザー操作→フェード復帰
  useEffect(() => {
    if (!isLocked) return

    const handleLockActivity = () => {
      showUi()
    }

    const events = ["mousemove", "mousedown", "keydown", "touchstart"]
    events.forEach((event) => {
      window.addEventListener(event, handleLockActivity, { passive: true })
    })

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, handleLockActivity)
      })
    }
  }, [isLocked, showUi])

  const resetPasscodeInput = useCallback(() => {
    passcodeRef.current = ""
    setPasscode("")
  }, [])

  // パスコード検証
  const verifyPasscode = useCallback(
    (code: string) => {
      if (!user?.id || !code) return
      setError("")
      verifyPasscodeMutate(
        { userId: user.id, passcode: code },
        {
          onSuccess: (isValid) => {
            if (isValid) {
              unlock()
              return
            }
            setError("パスコードが正しくありません")
            resetPasscodeInput()
          },
          onError: () => {
            setError("検証に失敗しました")
            resetPasscodeInput()
          },
        }
      )
    },
    [user?.id, unlock, resetPasscodeInput, verifyPasscodeMutate]
  )

  // keydownで直接数字パスコードを構築（IMEをバイパス）
  useEffect(() => {
    if (!isLocked) return

    const handlePasscodeKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (e.isComposing) return

      if (e.key === "Backspace") {
        e.preventDefault()
        const next = passcodeRef.current.slice(0, -1)
        passcodeRef.current = next
        setPasscode(next)
        setError("")
        return
      }

      // 数字のみ受け付ける
      if (!/^[0-9]$/.test(e.key)) return

      e.preventDefault()

      if (passcodeRef.current.length >= maxLength) return

      const next = passcodeRef.current + e.key
      passcodeRef.current = next
      setPasscode(next)
      setError("")

      // 桁数一致で自動検証
      if (next.length === maxLength) {
        verifyPasscode(next)
      }
    }

    window.addEventListener("keydown", handlePasscodeKey, true)
    return () => window.removeEventListener("keydown", handlePasscodeKey, true)
  }, [isLocked, maxLength, verifyPasscode])

  if (!isBlackout) return null

  return (
    <div
      className="fixed inset-0 z-9999 flex items-center justify-center bg-black"
      onClick={() => {
        // 施錠の有無は `isLocked` だけで決める（handleActivity と同じ理由）
        if (isLocked) {
          showUi()
        } else {
          unlock()
        }
      }}
      role="presentation"
    >
      {isLocked && (
        <>
          {/* フェード表示UI */}
          <div
            className="flex flex-col items-center gap-6 transition-opacity duration-500"
            style={{ opacity: uiVisible ? 1 : 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <Lock className="h-8 w-8 text-gray-500" />
            <p className="text-sm text-gray-400">
              パスコードを入力してロック解除
            </p>

            {/* ドット表示 */}
            <div className="flex gap-3">
              {Array.from({ length: maxLength }).map((_, i) => (
                <div
                  key={i}
                  className="flex h-4 w-4 items-center justify-center"
                >
                  {i < passcode.length ? (
                    <div className="h-3 w-3 rounded-full bg-white" />
                  ) : (
                    <div className="h-3 w-3 rounded-full border border-gray-600" />
                  )}
                </div>
              ))}
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}
          </div>
        </>
      )}
    </div>
  )
}
