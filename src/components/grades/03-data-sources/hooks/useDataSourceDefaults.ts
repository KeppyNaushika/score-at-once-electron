"use client"

import { useMemo } from "react"

import {
  computeMaxScoreFromPayload,
  type MaxScorePayloadSource,
} from "@/electron-src/lib/shared/calculations/gradeDataSourceMaxScore"

import {
  type AddDataSourceSelection,
  COURSEWORK_WHOLE,
  type CourseworkOption,
  type CropRegionOption,
  type ExamOption,
  type SubtotalGroupOption,
} from "../types"

interface UseDataSourceDefaultsOptions {
  selection: AddDataSourceSelection
  exams: ExamOption[]
  subtotalGroups: SubtotalGroupOption[]
  cropRegions: CropRegionOption[]
  courseworks: CourseworkOption[]
}

/** 選択中の資料と、その中で選ばれている評価項目（「資料全体」のときは undefined）。 */
function findCourseworkSelection(
  selection: AddDataSourceSelection,
  courseworks: CourseworkOption[]
) {
  const coursework = courseworks.find(
    (courseworkOption) => courseworkOption.id === selection.courseworkId
  )
  if (!coursework) return null
  if (selection.courseworkItemId === COURSEWORK_WHOLE) {
    return { coursework, courseworkItem: undefined }
  }
  const courseworkItem = coursework.items.find(
    (candidateCourseworkItem) =>
      candidateCourseworkItem.id === selection.courseworkItemId
  )
  return courseworkItem ? { coursework, courseworkItem } : null
}

/** 選択中の小計項目（所属グループを問わず id で引く）。 */
function findSubtotal(
  subtotalId: string,
  subtotalGroups: SubtotalGroupOption[]
) {
  return (
    subtotalGroups
      .flatMap((subtotalGroup) => subtotalGroup.subtotals)
      .find((subtotal) => subtotal.id === subtotalId) ?? null
  )
}

/**
 * 満点算出の元データを、取得済みの選択肢から組み立てる。
 * 算出ルール自体は main と共有する {@link computeMaxScoreFromPayload} に委ねる。
 * 選択が未完成で算出できない場合は null。
 */
function buildMaxScorePayload(
  selection: AddDataSourceSelection,
  cropRegions: CropRegionOption[],
  courseworks: CourseworkOption[]
): MaxScorePayloadSource | null {
  switch (selection.type) {
    case "exam_total":
      if (!selection.examId) return null
      return {
        type: "exam_total",
        examId: selection.examId,
        exam: { examPages: [{ cropRegions }] },
      }
    case "subtotal":
      if (!selection.examId || !selection.subtotalId) return null
      return {
        type: "subtotal",
        examId: selection.examId,
        subtotal: {
          cropSubtotals: cropRegions
            .filter((cropRegion) =>
              cropRegion.cropSubtotals.some(
                (cropSubtotal) =>
                  cropSubtotal.subtotalId === selection.subtotalId
              )
            )
            .map((cropRegion) => ({
              cropRegion: {
                id: cropRegion.id,
                points: cropRegion.points,
                examPage: { examId: selection.examId },
              },
            })),
        },
      }
    case "crop_region": {
      const cropRegion = cropRegions.find(
        (cropRegionOption) => cropRegionOption.id === selection.cropRegionId
      )
      if (!cropRegion) return null
      return { type: "crop_region", cropRegion: { points: cropRegion.points } }
    }
    case "coursework": {
      const courseworkSelection = findCourseworkSelection(
        selection,
        courseworks
      )
      if (!courseworkSelection) return null
      const { coursework, courseworkItem } = courseworkSelection
      // 「資料全体」は全評価項目の合計なので coursework_total として算出する
      return courseworkItem
        ? { type: "coursework", courseworkItem }
        : { type: "coursework_total", coursework }
    }
  }
}

/** 選択内容から既定の名前を組み立てる。選択が未完成なら空文字。 */
function buildDefaultName(
  selection: AddDataSourceSelection,
  exams: ExamOption[],
  subtotalGroups: SubtotalGroupOption[],
  cropRegions: CropRegionOption[],
  courseworks: CourseworkOption[]
): string {
  if (selection.type === "coursework") {
    const courseworkSelection = findCourseworkSelection(selection, courseworks)
    if (!courseworkSelection) return ""
    const { coursework, courseworkItem } = courseworkSelection
    return courseworkItem
      ? `${coursework.name}(${courseworkItem.name})`
      : `${coursework.name}(合計)`
  }

  const exam = exams.find((examOption) => examOption.id === selection.examId)
  if (!exam) return ""

  switch (selection.type) {
    case "exam_total":
      return `${exam.examName}(合計)`
    case "subtotal": {
      const subtotal = findSubtotal(selection.subtotalId, subtotalGroups)
      return subtotal ? `${exam.examName}(${subtotal.name})` : ""
    }
    case "crop_region": {
      const cropRegion = cropRegions.find(
        (cropRegionOption) => cropRegionOption.id === selection.cropRegionId
      )
      return cropRegion ? `${exam.examName}(${cropRegion.label})` : ""
    }
  }
}

/**
 * データソース追加フォームの「名前」「換算満点」の既定値を、選択内容から導く。
 *
 * どちらも state として持たず毎回算出する（ユーザーが入力したらそちらが優先される想定で、
 * 呼び出し側が下書きとの `??` で解決する）。満点の元データは選択肢の取得時に同梱済みなので
 * 追加の IPC は発生しない。
 */
export function useDataSourceDefaults({
  selection,
  exams,
  subtotalGroups,
  cropRegions,
  courseworks,
}: UseDataSourceDefaultsOptions) {
  return useMemo(() => {
    const payload = buildMaxScorePayload(selection, cropRegions, courseworks)
    const maxScore = payload ? computeMaxScoreFromPayload(payload) : 0
    return {
      defaultName: buildDefaultName(
        selection,
        exams,
        subtotalGroups,
        cropRegions,
        courseworks
      ),
      // 満点が未確定（0）の段階では換算満点を埋めない
      defaultWeight: maxScore > 0 ? String(maxScore) : "",
    }
  }, [selection, exams, subtotalGroups, cropRegions, courseworks])
}
