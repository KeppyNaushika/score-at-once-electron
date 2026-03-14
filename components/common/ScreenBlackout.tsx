"use client"

import { Lock } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"

import { useAuth } from "@/contexts/AuthContext"

const BLACKOUT_SETTINGS_KEY = "screenBlackoutSettings"
const FADE_TIMEOUT_MS = 3000

interface BlackoutSettings {
  enabled: boolean
  timeoutMinutes: number
  autoFullScreen: boolean
}

function getBlackoutSettings(): BlackoutSettings {
  try {
    const stored = localStorage.getItem(BLACKOUT_SETTINGS_KEY)
    if (stored) return JSON.parse(stored)
  } catch {
    // ignore
  }
  return { enabled: false, timeoutMinutes: 5, autoFullScreen: false }
}

export function ScreenBlackout() {
  const { user } = useAuth()
  const [isBlackout, setIsBlackout] = useState(false)
  const [isLocked, setIsLocked] = useState(false)
  const [settings, setSettings] = useState<BlackoutSettings>({
    enabled: false,
    timeoutMinutes: 5,
    autoFullScreen: false,
  })
  const [passcode, setPasscode] = useState("")
  const [passcodeType, setPasscodeType] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [uiVisible, setUiVisible] = useState(true)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hiddenInputRef = useRef<HTMLInputElement>(null)
  const wasFullScreenBeforeRef = useRef(false)

  // ユーザーのパスコードタイプを取得
  useEffect(() => {
    if (!user?.id) return
    const loadPasscodeType = async () => {
      try {
        const users = await window.electronAPI.fetchUsers()
        const currentUser = users.find((u: { id: string }) => u.id === user.id)
        setPasscodeType(currentUser?.passcodeType ?? "none")
      } catch {
        setPasscodeType("none")
      }
    }
    loadPasscodeType()
  }, [user?.id])

  const hasPasscode = passcodeType && passcodeType !== "none"
  const maxLength =
    passcodeType === "4digit" ? 4 : passcodeType === "6digit" ? 6 : undefined

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

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

  const enterFullScreenIfNeeded = useCallback(() => {
    const current = getBlackoutSettings()
    if (current.autoFullScreen && window.electronAPI?.settings?.setFullScreen) {
      wasFullScreenBeforeRef.current = !!document.fullscreenElement
      window.electronAPI.settings.setFullScreen(true)
    }
  }, [])

  const restoreFullScreenIfNeeded = useCallback(() => {
    const current = getBlackoutSettings()
    if (
      current.autoFullScreen &&
      !wasFullScreenBeforeRef.current &&
      window.electronAPI?.settings?.setFullScreen
    ) {
      window.electronAPI.settings.setFullScreen(false)
    }
  }, [])

  const startTimer = useCallback(
    (minutes: number) => {
      clearTimer()
      timerRef.current = setTimeout(
        () => {
          enterFullScreenIfNeeded()
          setIsBlackout(true)
          if (hasPasscode) {
            setIsLocked(true)
            setUiVisible(true)
            startFadeTimer()
          }
        },
        minutes * 60 * 1000
      )
    },
    [clearTimer, hasPasscode, enterFullScreenIfNeeded, startFadeTimer]
  )

  const unlock = useCallback(() => {
    restoreFullScreenIfNeeded()
    setIsBlackout(false)
    setIsLocked(false)
    setUiVisible(true)
    setPasscode("")
    setError("")
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current)
    const current = getBlackoutSettings()
    if (current.enabled) {
      startTimer(current.timeoutMinutes)
    }
  }, [startTimer, restoreFullScreenIfNeeded])

  // 手動ロック（Ctrl/Cmd + L）
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "l") {
        e.preventDefault()
        enterFullScreenIfNeeded()
        setIsBlackout(true)
        clearTimer()
        if (hasPasscode) {
          setIsLocked(true)
          setUiVisible(true)
          startFadeTimer()
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [hasPasscode, clearTimer, enterFullScreenIfNeeded, startFadeTimer])

  // 設定変更を監視
  useEffect(() => {
    const handleSettingsChange = () => {
      const newSettings = getBlackoutSettings()
      setSettings(newSettings)
      clearTimer()
      if (newSettings.enabled && !isLocked) {
        startTimer(newSettings.timeoutMinutes)
      }
      if (!isLocked) {
        setIsBlackout(false)
      }
    }

    handleSettingsChange()

    window.addEventListener(
      "screenBlackoutSettingsChanged",
      handleSettingsChange
    )
    return () => {
      window.removeEventListener(
        "screenBlackoutSettingsChanged",
        handleSettingsChange
      )
      clearTimer()
    }
  }, [clearTimer, startTimer, isLocked])

  // ユーザー操作でタイマーリセット（ロック中は無視）
  useEffect(() => {
    if (!settings.enabled || isLocked) return

    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"]

    const handleActivity = () => {
      if (isBlackout && !isLocked) {
        if (!hasPasscode) {
          unlock()
          return
        }
        return
      }
      clearTimer()
      if (settings.enabled) {
        startTimer(settings.timeoutMinutes)
      }
    }

    events.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true })
    })

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity)
      })
    }
  }, [
    settings.enabled,
    settings.timeoutMinutes,
    isBlackout,
    isLocked,
    hasPasscode,
    unlock,
    clearTimer,
    startTimer,
  ])

  // ロック画面でのユーザー操作→フェード復帰＋隠しinputにフォーカス
  useEffect(() => {
    if (!isLocked) return

    const handleLockActivity = (e: Event) => {
      showUi()
      // キーイベント以外（マウス/トラックパッド）の場合もinputにフォーカス
      if (e.type !== "keydown") {
        setTimeout(() => hiddenInputRef.current?.focus(), 0)
      }
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

  // ロック表示時に隠しinputへフォーカス
  useEffect(() => {
    if (isLocked && uiVisible) {
      setTimeout(() => hiddenInputRef.current?.focus(), 50)
    }
  }, [isLocked, uiVisible])

  // パスコードリセット（input要素を直接操作してフォーカス・入力を途切れさせない）
  const resetPasscodeInput = useCallback(() => {
    setPasscode("")
    if (hiddenInputRef.current) {
      hiddenInputRef.current.value = ""
      hiddenInputRef.current.focus()
    }
  }, [])

  // パスコード検証
  const verifyPasscode = useCallback(
    async (code: string) => {
      if (!user?.id || !code) return
      setError("")
      try {
        const isValid = await window.electronAPI.verifyPasscode(user.id, code)
        if (isValid) {
          unlock()
        } else {
          setError("パスコードが正しくありません")
          resetPasscodeInput()
        }
      } catch {
        setError("検証に失敗しました")
        resetPasscodeInput()
      }
    },
    [user?.id, unlock, resetPasscodeInput]
  )

  // 入力ハンドラー
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      let value = e.target.value
      // 数字パスコードの場合は数字のみ
      if (passcodeType === "4digit" || passcodeType === "6digit") {
        value = value.replace(/\D/g, "")
      }
      if (maxLength && value.length > maxLength) {
        value = value.slice(0, maxLength)
      }
      setPasscode(value)
      setError("")

      // 桁数一致で自動検証
      if (maxLength && value.length === maxLength) {
        verifyPasscode(value)
      }
    },
    [passcodeType, maxLength, verifyPasscode]
  )

  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && passcodeType === "alphanumeric") {
        e.preventDefault()
        verifyPasscode(passcode)
      }
    },
    [passcode, passcodeType, verifyPasscode]
  )

  if (!isBlackout) return null

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black"
      onClick={() => {
        if (!isLocked && !hasPasscode) {
          unlock()
        } else if (isLocked) {
          showUi()
          setTimeout(() => hiddenInputRef.current?.focus(), 0)
        }
      }}
      role="presentation"
    >
      {isLocked && (
        <>
          {/* 隠しinput: 常にDOMに存在しフォーカスを受ける */}
          <input
            ref={hiddenInputRef}
            type={passcodeType === "alphanumeric" ? "text" : "tel"}
            value={passcode}
            onChange={handleInputChange}
            onKeyDown={handleInputKeyDown}
            className="fixed -top-20 left-0 opacity-0"
            autoFocus
            inputMode={passcodeType === "alphanumeric" ? "text" : "numeric"}
            autoComplete="off"
            aria-label="パスコード入力"
          />

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
            {(passcodeType === "4digit" || passcodeType === "6digit") && (
              <div className="flex gap-3">
                {Array.from({ length: maxLength! }).map((_, i) => (
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
            )}

            {passcodeType === "alphanumeric" && (
              <div className="flex min-h-[28px] items-center gap-1">
                {passcode.length > 0 ? (
                  Array.from({ length: passcode.length }).map((_, i) => (
                    <div
                      key={i}
                      className="h-2.5 w-2.5 rounded-full bg-white"
                    />
                  ))
                ) : (
                  <p className="text-sm text-gray-600">
                    キーボードで入力してください
                  </p>
                )}
              </div>
            )}

            {error && <p className="text-sm text-red-400">{error}</p>}
          </div>
        </>
      )}
    </div>
  )
}
