import { useEffect, useState } from "react"
import {
  getScoringStatusColors,
  type ScoringStatusColors,
} from "@/lib/scoringStatusColors"

/**
 * 採点状態色を取得・監視するフック
 *
 * 設定画面で色が変更された際にリアルタイムで反映される
 */
export function useScoringStatusColors(): ScoringStatusColors {
  const [colors, setColors] = useState<ScoringStatusColors>(
    getScoringStatusColors
  )

  useEffect(() => {
    const handleChange = () => {
      setColors(getScoringStatusColors())
    }

    // 設定画面からの変更イベントを監視
    window.addEventListener("scoringStatusColorsChanged", handleChange)
    // 他タブからのlocalStorage変更も監視
    window.addEventListener("storage", handleChange)

    return () => {
      window.removeEventListener("scoringStatusColorsChanged", handleChange)
      window.removeEventListener("storage", handleChange)
    }
  }, [])

  return colors
}
