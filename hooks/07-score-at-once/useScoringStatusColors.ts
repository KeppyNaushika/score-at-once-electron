import { useAuth } from "@/contexts/AuthContext"
import { useEffect, useRef, useState } from "react"
import {
  getScoringStatusColors,
  loadScoringStatusColors,
  type ScoringStatusColors,
} from "@/lib/scoringStatusColors"

/**
 * 採点状態色を取得・監視するフック
 *
 * 設定画面で色が変更された際にリアルタイムで反映される
 */
export function useScoringStatusColors(): ScoringStatusColors {
  const { user } = useAuth()
  const userId = user?.id
  const initializedRef = useRef(false)

  const [colors, setColors] = useState<ScoringStatusColors>(
    getScoringStatusColors
  )

  // 初期化時にDBから読み込み
  useEffect(() => {
    if (initializedRef.current || !userId) return
    initializedRef.current = true

    const init = async () => {
      await loadScoringStatusColors(userId)
      setColors(getScoringStatusColors())
    }
    init()
  }, [userId])

  useEffect(() => {
    const handleChange = () => {
      setColors(getScoringStatusColors())
    }

    // 設定画面からの変更イベントを監視
    window.addEventListener("scoringStatusColorsChanged", handleChange)

    return () => {
      window.removeEventListener("scoringStatusColorsChanged", handleChange)
    }
  }, [])

  return colors
}
