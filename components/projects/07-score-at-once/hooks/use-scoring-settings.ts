import { useState, useEffect } from "react"

interface ScoringSettings {
  itemsPerRow: number[]
  autoScroll: boolean
  showStudentNames: boolean
}

export function useScoringSettings() {
  const [itemsPerRow, setItemsPerRow] = useState([5])
  const [autoScroll, setAutoScroll] = useState(true)
  const [showStudentNames, setShowStudentNames] = useState(true)

  // localStorage から設定を読み込む
  useEffect(() => {
    const loadSettings = () => {
      try {
        const savedItemsPerRow = localStorage.getItem("scoring-itemsPerRow")
        if (savedItemsPerRow) {
          setItemsPerRow(JSON.parse(savedItemsPerRow))
        }

        const savedAutoScroll = localStorage.getItem("scoring-autoScroll")
        if (savedAutoScroll) {
          setAutoScroll(JSON.parse(savedAutoScroll))
        }

        const savedShowStudentNames = localStorage.getItem("scoring-showStudentNames")
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
  const saveItemsPerRow = (value: number[]) => {
    setItemsPerRow(value)
    localStorage.setItem("scoring-itemsPerRow", JSON.stringify(value))
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
    itemsPerRow,
    autoScroll,
    showStudentNames,
    setItemsPerRow: saveItemsPerRow,
    setAutoScroll: saveAutoScroll,
    setShowStudentNames: saveShowStudentNames,
  }
}