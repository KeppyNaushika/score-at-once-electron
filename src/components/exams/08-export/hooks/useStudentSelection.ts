"use client"

import { useCallback, useState } from "react"

/**
 * 出力対象の生徒選択を一元管理するフック。
 *
 * 選択集合は `Set<string>`（studentId）で保持する（`.has()` が O(1)・`.size` が安価で、
 * チェックボックス描画に最適）。ただし集合の変異は本フックのインテントメソッドに閉じ込め、
 * 生の setState を prop 境界へ渡さない。各画面（StudentSelectionCard / ReturnDiffPanel 等）は
 * 「トグルする」「まとめて追加する」といった意図だけを呼び、Set の複製ロジックを重複させない。
 */
export interface StudentSelection {
  /** 選択中の生徒ID集合（描画時の `.has()` / `.size` 参照用。書き込みは各メソッド経由） */
  selectedStudentIds: Set<string>
  /** 選択集合を丸ごと差し替える（初期化・「変更があった生徒のみ」等） */
  replaceSelection: (studentIds: Iterable<string>) => void
  /** 1名の選択をトグルする */
  toggleStudent: (studentId: string) => void
  /** 指定生徒を選択へ追加する（和集合） */
  addStudents: (studentIds: Iterable<string>) => void
  /** 指定生徒を選択から除外する（差集合） */
  removeStudents: (studentIds: Iterable<string>) => void
}

export function useStudentSelection(): StudentSelection {
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(
    () => new Set()
  )

  const replaceSelection = useCallback((studentIds: Iterable<string>) => {
    setSelectedStudentIds(new Set(studentIds))
  }, [])

  const toggleStudent = useCallback((studentId: string) => {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev)
      if (next.has(studentId)) {
        next.delete(studentId)
      } else {
        next.add(studentId)
      }
      return next
    })
  }, [])

  const addStudents = useCallback((studentIds: Iterable<string>) => {
    setSelectedStudentIds((prev) => new Set([...prev, ...studentIds]))
  }, [])

  const removeStudents = useCallback((studentIds: Iterable<string>) => {
    const removal = new Set(studentIds)
    setSelectedStudentIds(
      (prev) =>
        new Set([...prev].filter((studentId) => !removal.has(studentId)))
    )
  }, [])

  // メソッドは useCallback で安定、集合の変化時のみ再描画したいので、
  // オブジェクトはそのまま返す（唯一の消費者は即座に分解代入するため同一性は不問）。
  return {
    selectedStudentIds,
    replaceSelection,
    toggleStudent,
    addStudents,
    removeStudents,
  }
}
