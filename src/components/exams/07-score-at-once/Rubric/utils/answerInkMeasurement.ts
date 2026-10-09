/**
 * インクの測定（朱書きの配置に使う占有グリッド）の受け取り方（docs/vlm-grading-design.md §8・§9）。
 *
 * main は答案画像ごとに、測れた枠だけを返す（読めない画像・枠が画像の外の答案は
 * 現れない）。現れなかった答案は「測れなかった」として扱い、枠全体を空きとして置く。
 */

import type { CropRegion, StudentAnswerImage } from "@prisma/client"

import type { RegionInkMeasurementRow } from "../types"

/** 測定の結果（答案画像ごと） */
interface AnswerInkMeasurement {
  studentAnswerImageId: string
  regions: readonly RegionInkMeasurementRow[]
}

/**
 * 測るもの全部（設問の矩形・答案の id と画像パス）を表す文字列。
 * これが変われば測り直す（採点を書いても変わらない）
 */
export function buildInkMeasurementSignature(
  cropRegion: Pick<CropRegion, "x" | "y" | "width" | "height">,
  studentAnswerImages: readonly Pick<StudentAnswerImage, "id" | "imagePath">[]
): string {
  return [
    [cropRegion.x, cropRegion.y, cropRegion.width, cropRegion.height].join(","),
    ...studentAnswerImages.map(
      (studentAnswerImage) =>
        `${studentAnswerImage.id}=${studentAnswerImage.imagePath}`
    ),
  ].join("|")
}

/** 答案画像 id → この設問の測定 */
function indexInkMeasurements(
  measurements: readonly AnswerInkMeasurement[],
  cropRegionId: string
): Map<string, RegionInkMeasurementRow> {
  const inkMeasurementByAnswerImageId = new Map<
    string,
    RegionInkMeasurementRow
  >()
  for (const measurement of measurements) {
    const regionMeasurement = measurement.regions.find(
      (region) => region.cropRegionId === cropRegionId
    )
    if (regionMeasurement) {
      inkMeasurementByAnswerImageId.set(
        measurement.studentAnswerImageId,
        regionMeasurement
      )
    }
  }
  return inkMeasurementByAnswerImageId
}

/** 受験者 → この設問の占有グリッド（測れた答案だけ） */
export function indexInkGridsByExamStudent(
  measurements: readonly AnswerInkMeasurement[],
  cropRegionId: string,
  studentAnswerImages: readonly Pick<
    StudentAnswerImage,
    "id" | "examStudentId"
  >[]
): Map<string, RegionInkMeasurementRow["inkGrid"]> {
  const inkMeasurementByAnswerImageId = indexInkMeasurements(
    measurements,
    cropRegionId
  )
  return new Map(
    studentAnswerImages.flatMap((studentAnswerImage) => {
      const inkMeasurement = inkMeasurementByAnswerImageId.get(
        studentAnswerImage.id
      )
      return inkMeasurement
        ? [[studentAnswerImage.examStudentId, inkMeasurement.inkGrid] as const]
        : []
    })
  )
}
