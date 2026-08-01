/**
 * 成績データソースの満点（換算満点の初期値）を算出するルール。
 *
 * 満点は GradeDataSource.maxScore 列ではなく、常に元データ（設問配点 / 評価項目満点）から
 * 導く。元データを後から変更しても追従させるため。
 *
 * このモジュールは DB へアクセスしない純粋関数だけを持つ。main（Prisma の include 出力から
 * 算出）と renderer（既に取得済みの選択肢から算出）の双方が同じルールを共有するため、
 * 分岐ロジックはここが単一のソースになる。
 */

import type { GradeDataSourceMaxScoreRef } from "../../../../src/types/prismaExtensions"

/**
 * 満点算出に必要な元データ。
 *
 * 各リレーションは種別ごとに1つだけ使われる（`type` が `crop_region` なら `cropRegion` のみ）。
 * main 側は `gradeDataSourceInclude` 同梱の payload をそのまま渡し、renderer 側は
 * 取得済みの選択肢からこの形へ組み立てて渡す。
 */
export type MaxScorePayloadSource = GradeDataSourceMaxScoreRef & {
  cropRegion?: { points: number | null } | null
  courseworkItem?: { maxScore: unknown } | null
  coursework?: { items: Array<{ maxScore: unknown }> } | null
  exam?: {
    examPages: Array<{ cropRegions: Array<{ points: number | null }> }>
  } | null
  subtotal?: {
    cropSubtotals: Array<{
      cropRegion: { points: number | null; examPage: { examId: string } }
    }>
  } | null
}

/**
 * 元データから満点を同期算出する。追加の DB アクセスは行わない。
 *
 * 評価項目の満点は Prisma の Decimal で、IPC を渡ると文字列化され得るため必ず数値化する。
 */
export function computeMaxScoreFromPayload(
  dataSource: MaxScorePayloadSource
): number {
  switch (dataSource.type) {
    case "crop_region":
      return dataSource.cropRegion?.points ?? 0
    case "coursework":
      return Number(dataSource.courseworkItem?.maxScore ?? 0)
    case "coursework_total":
      return (dataSource.coursework?.items ?? []).reduce(
        (sum, courseworkItem) => sum + Number(courseworkItem.maxScore),
        0
      )
    case "exam_total":
      return (dataSource.exam?.examPages ?? [])
        .flatMap((examPage) => examPage.cropRegions)
        .reduce((sum, cropRegion) => sum + (cropRegion.points ?? 0), 0)
    case "subtotal":
      return (dataSource.subtotal?.cropSubtotals ?? [])
        .filter(
          (cropSubtotal) =>
            cropSubtotal.cropRegion.examPage.examId === dataSource.examId
        )
        .reduce(
          (sum, cropSubtotal) => sum + (cropSubtotal.cropRegion.points ?? 0),
          0
        )
    default:
      return 0
  }
}
