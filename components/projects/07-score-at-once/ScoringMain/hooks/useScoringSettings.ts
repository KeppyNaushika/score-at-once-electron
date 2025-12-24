import type { LayoutDirection } from "@/components/projects/07-score-at-once/types"
import { useEffect, useState } from "react"

const DEFAULT_LAYOUT_DIRECTION: LayoutDirection = "right-down"

export function useScoringSettings() {
  const [itemsPerLine, setItemsPerLine] = useState([5])
  const [autoScroll, setAutoScroll] = useState(true)
  const [showStudentNames, setShowStudentNames] = useState(true)
  const [layoutDirection, setLayoutDirection] = useState<LayoutDirection>(DEFAULT_LAYOUT_DIRECTION)

  // localStorage から設定を読み込む
  useEffect(() => {
    const loadSettings = () => {
      try {
        const savedItemsPerLine = localStorage.getItem("scoring-itemsPerLine")
        if (savedItemsPerLine) {
          setItemsPerLine(JSON.parse(savedItemsPerLine))
        }

        const savedAutoScroll = localStorage.getItem("scoring-autoScroll")
        if (savedAutoScroll) {
          setAutoScroll(JSON.parse(savedAutoScroll))
        }

        const savedShowStudentNames = localStorage.getItem(
          "scoring-showStudentNames",
        )
        if (savedShowStudentNames) {
          setShowStudentNames(JSON.parse(savedShowStudentNames))
        }

        const savedLayoutDirection = localStorage.getItem("scoring-layoutDirection")
        if (savedLayoutDirection) {
          setLayoutDirection(JSON.parse(savedLayoutDirection))
        }
      } catch (error) {
        console.error("設定の読み込みに失敗しました:", error)
      }
    }

    loadSettings()
  }, [])

  // 設定を保存する関数
  const saveItemsPerLine = (value: number[]) => {
    setItemsPerLine(value)
    localStorage.setItem("scoring-itemsPerLine", JSON.stringify(value))
  }

  const saveAutoScroll = (value: boolean) => {
    setAutoScroll(value)
    localStorage.setItem("scoring-autoScroll", JSON.stringify(value))
  }

  const saveShowStudentNames = (value: boolean) => {
    setShowStudentNames(value)
    localStorage.setItem("scoring-showStudentNames", JSON.stringify(value))
  }

  const saveLayoutDirection = (value: LayoutDirection) => {
    setLayoutDirection(value)
    localStorage.setItem("scoring-layoutDirection", JSON.stringify(value))
  }

  return {
    itemsPerLine,
    autoScroll,
    showStudentNames,
    layoutDirection,
    setItemsPerLine: saveItemsPerLine,
    setAutoScroll: saveAutoScroll,
    setShowStudentNames: saveShowStudentNames,
    setLayoutDirection: saveLayoutDirection,
  }
}
