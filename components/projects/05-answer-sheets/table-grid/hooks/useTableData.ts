import { useCallback, useMemo } from "react"
import type { UnifiedFile, UnifiedStudent, PlacementStrategy } from "@/types/answer-sheet.types"
import type { CellData, ExtendedDisabledState } from "../types"

export function useTableData(
  files: UnifiedFile[],
  students: UnifiedStudent[],
  masterImageCount: number,
  fileOrder: PlacementStrategy,
  disabledState: ExtendedDisabledState,
  isPositionDisabled: (position: number, maxPages: number) => boolean,
) {
  // 受験生徒順序でソート（customOrder準拠）
  const sortedStudents = useMemo(() => {
    return [...students].sort((a, b) => {
      // customOrderが設定されている場合はそれを優先
      if (
        a.customOrder !== null &&
        a.customOrder !== undefined &&
        b.customOrder !== null &&
        b.customOrder !== undefined
      ) {
        return a.customOrder - b.customOrder
      }
      if (a.customOrder !== null && a.customOrder !== undefined) return -1
      if (b.customOrder !== null && b.customOrder !== undefined) return 1

      // customOrderが未設定の場合は出席番号順をフォールバック
      const aNumber = a.attendanceNumber
      const bNumber = b.attendanceNumber

      if (aNumber && bNumber) {
        return aNumber - bNumber
      }
      if (aNumber) return -1
      if (bNumber) return 1

      // 出席番号もない場合は名前順
      const aName = `${a.lastName}${a.firstName}`
      const bName = `${b.lastName}${b.firstName}`
      return aName.localeCompare(bName)
    })
  }, [students])

  // 有効ファイルと無効ファイルを取得
  const getEnabledFiles = useCallback(() => {
    return files.filter((file) => !disabledState.files.has(file.id))
  }, [files, disabledState.files])

  const getDisabledFiles = useCallback(() => {
    return files.filter((file) => disabledState.files.has(file.id))
  }, [files, disabledState.files])

  // ファイルの色を取得
  const getFileColor = useCallback((file: UnifiedFile) => {
    const index = file.originalFileName.charCodeAt(0) % 6
    const colors = [
      "bg-blue-400",
      "bg-green-400", 
      "bg-yellow-400",
      "bg-purple-400",
      "bg-pink-400",
      "bg-indigo-400",
    ]
    return colors[index]
  }, [])

  // table-dnd-kit-test準拠の動的テーブルデータ生成
  const getTableData = useCallback((): CellData[][] => {
    // 次の有効ファイルを取得する関数（無効化されていないファイルのみ）
    const enabledFiles = files.filter(
      (file) => file && file.id && !disabledState.files.has(file.id),
    )
    let enabledFileIndex = 0

    const getNextFile = () => {
      if (enabledFileIndex < enabledFiles.length) {
        return enabledFiles[enabledFileIndex++]
      }
      return null
    }

    if (fileOrder === "page-first") {
      // ページ優先配置（列優先と同等）- ページ毎にファイルを配置: A→D→G / B→E→H
      const result: CellData[][] = Array.from(
        { length: sortedStudents.length },
        (_, studentIndex) =>
          Array.from({ length: masterImageCount }, (_, pageIndex) => {
            const position = studentIndex * masterImageCount + pageIndex
            const student = sortedStudents[studentIndex]
            if (isPositionDisabled(position, masterImageCount)) {
              return {
                type: "disabled" as const,
                position,
                student,
                pageNumber: pageIndex + 1,
              }
            } else {
              return {
                type: "empty" as const,
                position,
                student,
                pageNumber: pageIndex + 1,
              }
            }
          }),
      )

      // ページ毎（列毎）にファイルを配置
      for (let pageIndex = 0; pageIndex < masterImageCount; pageIndex++) {
        for (let studentIndex = 0; studentIndex < sortedStudents.length; studentIndex++) {
          const position = studentIndex * masterImageCount + pageIndex
          if (!isPositionDisabled(position, masterImageCount)) {
            const file = getNextFile()
            if (file) {
              result[studentIndex][pageIndex] = {
                type: "file",
                position,
                file,
                student: sortedStudents[studentIndex],
                pageNumber: pageIndex + 1,
              }
            }
          }
        }
      }

      return result
    } else {
      // 生徒優先配置（行優先と同等）- 生徒毎にファイルを配置: A→B→C / D→E→F
      const result: CellData[][] = Array.from(
        { length: sortedStudents.length },
        (_, studentIndex) =>
          Array.from({ length: masterImageCount }, (_, pageIndex) => {
            const position = studentIndex * masterImageCount + pageIndex
            const student = sortedStudents[studentIndex]
            if (isPositionDisabled(position, masterImageCount)) {
              return {
                type: "disabled" as const,
                position,
                student,
                pageNumber: pageIndex + 1,
              }
            } else {
              return {
                type: "empty" as const,
                position,
                student,
                pageNumber: pageIndex + 1,
              }
            }
          }),
      )

      // 生徒毎（行毎）にファイルを配置
      for (let studentIndex = 0; studentIndex < sortedStudents.length; studentIndex++) {
        for (let pageIndex = 0; pageIndex < masterImageCount; pageIndex++) {
          const position = studentIndex * masterImageCount + pageIndex
          if (!isPositionDisabled(position, masterImageCount)) {
            const file = getNextFile()
            if (file) {
              result[studentIndex][pageIndex] = {
                type: "file",
                position,
                file,
                student: sortedStudents[studentIndex],
                pageNumber: pageIndex + 1,
              }
            }
          }
        }
      }

      return result
    }
  }, [files, sortedStudents, masterImageCount, fileOrder, disabledState.files, isPositionDisabled])

  const tableData = useMemo(() => getTableData(), [getTableData])

  return {
    sortedStudents,
    getEnabledFiles,
    getDisabledFiles,
    getFileColor,
    tableData,
  }
}