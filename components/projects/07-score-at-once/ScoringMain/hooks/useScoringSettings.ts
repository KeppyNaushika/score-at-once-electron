import { useEffect, useState } from "react"

export function useScoringSettings() {
  const [itemsPerLine, setItemsPerLine] = useState([5])
  const [autoScroll, setAutoScroll] = useState(true)
  const [showStudentNames, setShowStudentNames] = useState(true)

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

  return {
    itemsPerLine,
    autoScroll,
    showStudentNames,
    setItemsPerLine: saveItemsPerLine,
    setAutoScroll: saveAutoScroll,
    setShowStudentNames: saveShowStudentNames,
  }
}
