import { useEffect, useState } from "react"
import { getSelectionBorderSettings } from "@/lib/utils"

export function useSelectionBorder() {
  const [selectionBorderSettings, setSelectionBorderSettings] = useState(
    getSelectionBorderSettings(),
  )

  // 選択枠色の設定変更を監視
  useEffect(() => {
    const handleStorageChange = () => {
      setSelectionBorderSettings(getSelectionBorderSettings())
    }

    window.addEventListener("storage", handleStorageChange)
    // カスタムイベントでも監視（同じページ内での変更）
    window.addEventListener("selectionBorderColorChanged", handleStorageChange)

    return () => {
      window.removeEventListener("storage", handleStorageChange)
      window.removeEventListener(
        "selectionBorderColorChanged",
        handleStorageChange,
      )
    }
  }, [])

  return selectionBorderSettings
}