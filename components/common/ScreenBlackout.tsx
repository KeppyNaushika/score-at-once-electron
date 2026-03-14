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
  const wasFullScreenBeforeRef = useRef(false)
  const passcodeRef = useRef("")

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

  // ロック対象は数字パスコード（4桁/6桁）のみ
  // 英数字パスコードはkeydownベースのIMEバイパスと相性が悪く、ロック解除不能になるリスクがある
  const hasDigitPasscode =
    passcodeType === "4digit" || passcodeType === "6digit"
  const maxLength = passcodeType === "4digit" ? 4 : 6

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

  const enterFullScreenIfNeeded = useCallback(async () => {
    const current = getBlackoutSettings()
    if (current.autoFullScreen && window.electronAPI?.settings?.setFullScreen) {
      const result = await window.electronAPI.settings.getFullScreen()
      wasFullScreenBeforeRef.current = result.success
        ? (result.fullScreen ?? false)
        : false
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
        async () => {
          await enterFullScreenIfNeeded()
          setIsBlackout(true)
          if (hasDigitPasscode) {
            setIsLocked(true)
            setUiVisible(true)
            startFadeTimer()
          }
        },
        minutes * 60 * 1000
      )
    },
    [clearTimer, hasDigitPasscode, enterFullScreenIfNeeded, startFadeTimer]
  )

  const unlock = useCallback(() => {
    restoreFullScreenIfNeeded()
    setIsBlackout(false)
    setIsLocked(false)
    setUiVisible(true)
    passcodeRef.current = ""
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
    const handleKeyDown = async (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "l") {
        e.preventDefault()
        await enterFullScreenIfNeeded()
        setIsBlackout(true)
        clearTimer()
        if (hasDigitPasscode) {
          setIsLocked(true)
          setUiVisible(true)
          startFadeTimer()
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [hasDigitPasscode, clearTimer, enterFullScreenIfNeeded, startFadeTimer])

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
        if (!hasDigitPasscode) {
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
    hasDigitPasscode,
    unlock,
    clearTimer,
    startTimer,
  ])

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
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black"
      onClick={() => {
        if (!isLocked && !hasDigitPasscode) {
          unlock()
        } else if (isLocked) {
          showUi()
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
