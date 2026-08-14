import type { CropRegionArea } from "@/components/exams/02-template/types"
import type { CropRegionAreaType } from "@/types/cropRegionAreaType.types"

/**
 * 新しく引いた採点領域の既定のラベルを決める。
 *
 * 設問だけは通し番号を振るので、その面に既にある設問の数を数える。
 */
export function buildNewCropRegionLabel(
  type: CropRegionAreaType,
  existingAreas: CropRegionArea[]
): string {
  switch (type) {
    case "STUDENT_NAME":
      return "氏名"
    case "STUDENT_ID":
      return "生徒番号"
    case "QUESTION_ANSWER":
      return `設問 ${
        existingAreas.filter((area) => area.type === "QUESTION_ANSWER").length +
        1
      }`
    case "TOTAL_SCORE":
      return "合計点"
    case "SUBTOTAL_SCORE":
      return "小計"
    default:
      return "新規エリア"
  }
}
