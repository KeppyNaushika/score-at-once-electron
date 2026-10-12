import type { CropRegionAreaType } from "@/types/cropRegionAreaType.types"

/**
 * 採点領域の種類の呼び名。02（領域作成）・03（領域設定）・解答用紙作成の記入欄の連携先が
 * ここを引く（写しを持たない — 3か所で「設問解答」「生徒番号」「受験番号」などへずれていた。#1492）
 */
export const CROP_REGION_AREA_TYPE_LABELS: Record<CropRegionAreaType, string> =
  {
    QUESTION_ANSWER: "設問",
    STUDENT_NAME: "氏名",
    STUDENT_ID: "番号",
    TOTAL_SCORE: "合計",
    SUBTOTAL_SCORE: "小計",
    MARK: "マーク",
    COMMENT: "コメント",
    OTHER: "その他",
  }
