import { useState, useRef, useCallback, useEffect } from "react"

const SAVE_STATUS_MESSAGES = [
  "　",
  "保存しています...",
  "保存されました",
] as const
type SaveStatusMessage = (typeof SAVE_STATUS_MESSAGES)[number]

interface UseSaveStatusOptions {
  initialMessage?: SaveStatusMessage
  savingMessage?: SaveStatusMessage
  savedMessage?: SaveStatusMessage
  displayDuration?: number // ms
}

export const useSaveStatus = (options?: UseSaveStatusOptions) => {
  const {
    initialMessage = SAVE_STATUS_MESSAGES[0],
    savingMessage = SAVE_STATUS_MESSAGES[1],
    savedMessage = SAVE_STATUS_MESSAGES[2],
    displayDuration = 2000, // "保存されました" の表示時間
  } = options || {}

  const [saveStatus, setSaveStatus] =
    useState<SaveStatusMessage>(initialMessage)
  const timeoutId = useRef<NodeJS.Timeout | null>(null)

  const showSaving = useCallback(() => {
    if (timeoutId.current !== null) {
      clearTimeout(timeoutId.current)
      timeoutId.current = null
    }
    setSaveStatus(savingMessage)
  }, [savingMessage])

  const showSaved = useCallback(() => {
    setSaveStatus(savedMessage)
    if (timeoutId.current !== null) {
      clearTimeout(timeoutId.current)
    }
    timeoutId.current = setTimeout(() => {
      setSaveStatus(initialMessage)
      timeoutId.current = null
    }, displayDuration)
  }, [savedMessage, initialMessage, displayDuration])

  const resetSaveStatus = useCallback(() => {
    if (timeoutId.current !== null) {
      clearTimeout(timeoutId.current)
      timeoutId.current = null
    }
    setSaveStatus(initialMessage)
  }, [initialMessage])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutId.current !== null) {
        clearTimeout(timeoutId.current)
      }
    }
  }, [])

  return {
    saveStatus,
    showSaving,
    showSaved,
    resetSaveStatus,
    // 以前の setSaveStatusState のような直接的なセッターが必要な場合は追加
    // setSaveStatusDirectly: setSaveStatus,
  }
}
