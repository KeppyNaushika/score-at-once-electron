import { useEffect, useState } from "react"
import { getSelectionBorderSettings } from "@/lib/utils"

/**
 * 選択枠の色を取得・監視するフック
 * @returns 選択枠の色（HEX形式）
 */
export function useSelectionBorder(): string {
  const [color, setColor] = useState(() => getSelectionBorderSettings().color)

  // 選択枠色の設定変更を監視
  useEffect(() => {
    const handleStorageChange = () => {
      setColor(getSelectionBorderSettings().color)
    }

    window.addEventListener("storage", handleStorageChange)
    // カスタムイベントでも監視（同じページ内での変更）
    window.addEventListener("selectionBorderColorChanged", handleStorageChange)

    return () => {
      window.removeEventListener("storage", handleStorageChange)
      window.removeEventListener(
        "selectionBorderColorChanged",
        handleStorageChange
      )
    }
  }, [])

  return color
}
