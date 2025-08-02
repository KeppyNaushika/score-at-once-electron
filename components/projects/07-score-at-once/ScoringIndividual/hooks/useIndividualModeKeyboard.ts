import { useEffect } from "react"
import type { ScoringBehavior } from "../components/ScoringBehaviorSelector"

interface UseIndividualModeKeyboardProps {
  // 基本データ
  questionRegions: any[]
  students: any[]
  currentQuestionIndex: number
  currentStudentId: string
  scoringBehavior: ScoringBehavior
  enabled?: boolean // 個別表示モードでのみ有効にするフラグ
  
  // ナビゲーション関数
  onQuestionChange: (index: number) => void
  onStudentChange: (studentId: string) => void
  
  // 採点関数
  onSetScore: (status: any) => void
  
  // その他のアクション
  onNextQuestion: () => void
  onPrevQuestion: () => void
  onNextStudent: () => void
  onPrevStudent: () => void
}

export function useIndividualModeKeyboard({
  questionRegions,
  students,
  currentQuestionIndex,
  currentStudentId,
  scoringBehavior,
  enabled = true,
  onQuestionChange,
  onStudentChange,
  onSetScore,
  onNextQuestion,
  onPrevQuestion,
  onNextStudent,
  onPrevStudent,
}: UseIndividualModeKeyboardProps) {
  
  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // 入力フィールドにフォーカスがある場合はスキップ
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      // Shift + 数字キー：設問直接移動
      if (e.shiftKey && !e.ctrlKey && !e.metaKey) {
        const key = e.key.toLowerCase()
        
        // Shift + D, F, G, H, J, K, L: 設問1-7への移動
        const questionKeys = ['d', 'f', 'g', 'h', 'j', 'k', 'l']
        const keyIndex = questionKeys.indexOf(key)
        
        if (keyIndex !== -1 && keyIndex < questionRegions.length) {
          e.preventDefault()
          onQuestionChange(keyIndex)
          return
        }
      }

      // 採点キー（Q, E, F, J, O, P）
      if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
        const key = e.key.toLowerCase()
        let scoreStatus: any = null

        switch (key) {
          case 'q':
            scoreStatus = 'CORRECT'
            break
          case 'e':
            scoreStatus = 'INCORRECT'
            break
          case 'f':
            scoreStatus = 'PARTIAL'
            break
          case 'j':
            scoreStatus = 'BLANK'
            break
          case 'o':
            scoreStatus = 'PENDING'
            break
          case 'p':
            scoreStatus = 'SKIP'
            break
        }

        if (scoreStatus) {
          e.preventDefault()
          onSetScore(scoreStatus)
          
          // 採点後の自動進行
          handleAutoAdvance()
          return
        }
      }

      // ナビゲーションキー
      if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
        switch (e.key) {
          case 'ArrowLeft':
          case 'a':
            e.preventDefault()
            onPrevQuestion()
            break
          case 'ArrowRight':
          case 'd':
            e.preventDefault()
            onNextQuestion()
            break
          case 'ArrowUp':
          case 'w':
            e.preventDefault()
            onPrevStudent()
            break
          case 'ArrowDown':
          case 's':
            e.preventDefault()
            onNextStudent()
            break
        }
      }
    }

    const handleAutoAdvance = () => {
      if (scoringBehavior === 'next-student') {
        // 次の生徒の同じ設問
        onNextStudent()
      } else if (scoringBehavior === 'next-question') {
        // 同じ生徒の次の設問
        onNextQuestion()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [
    enabled,
    questionRegions,
    students,
    currentQuestionIndex,
    currentStudentId,
    scoringBehavior,
    onQuestionChange,
    onStudentChange,
    onSetScore,
    onNextQuestion,
    onPrevQuestion,
    onNextStudent,
    onPrevStudent,
  ])
}