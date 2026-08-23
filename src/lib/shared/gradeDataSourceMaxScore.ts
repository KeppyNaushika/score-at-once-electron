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

import { selectExamCropRegions } from "@/lib/shared/subtotalAssignments"

/**
 * 満点算出に必要な元データ。
 *
 * 各リレーションは種別ごとに1つだけ使われる（`type` が `crop_region` なら `cropRegion` のみ）。
 * main 側は取得した GradeDataSource の行をそのまま渡し、renderer 側は取得済みの選択肢から
 * この形へ組み立てて渡す。
 *
 * 各IDは持たない。満点は「どの元データか」ではなく「元データそのもの」から出るため、
 * 種別と（試験横断の小計を絞る）examId 以外は算出に要らない。
 */
export interface MaxScorePayloadSource {
  type: string
  examId?: string | null
  cropRegion?: { points: number | null } | null
  courseworkItem?: { maxScore: unknown } | null
  coursework?: { items: Array<{ maxScore: unknown }> } | null
  exam?: {
    examPages: Array<{ cropRegions: Array<{ points: number | null }> }>
  } | null
  subtotal?: {
    cropSubtotals: Array<{
      // id はグループ内の複数の小計に同じ設問が割り当たったときに畳むために要る
      cropRegion: {
        id: string
        points: number | null
        examPage: { examId: string }
      }
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
      // 得点側（computeSubtotalScore）と同じ規則で畳んでから合計する。
      // 片方だけ重複を残すと満点と得点が食い違い、成績ラベルが静かにずれる。
      return selectExamCropRegions(
        dataSource.examId ?? "",
        dataSource.subtotal?.cropSubtotals ?? []
      ).reduce((sum, cropRegion) => sum + (cropRegion.points ?? 0), 0)
    default:
      return 0
  }
}
