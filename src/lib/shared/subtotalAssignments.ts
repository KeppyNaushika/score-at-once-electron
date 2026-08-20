/**
 * 小計への設問割り当ての読み方（純粋・prisma 非依存）。
 *
 * 「この小計に割り当てられた、この試験の設問領域」を取り出す規則は、得点の算出
 * （subtotalCalculator）と満点の算出（gradeDataSourceMaxScore）の両方が必要とする。
 * 実装が分かれていると片方だけ重複を畳んで満点と得点が食い違うため、ここに1本だけ置く。
 *
 * gradeDataSourceMaxScore は renderer からも import されるので、このモジュールは
 * prisma に触れてはならない。
 */

/**
 * 割り当て先の設問領域に最低限求める形。
 *
 * `id` は重複排除に、`examPage.examId` は試験の絞り込みに要る。
 * SubtotalGroup は複数の試験で共有されうるので、どちらも省けない。
 */
interface AssignedCropRegionRef {
  id: string
  examPage: { examId: string }
}

/**
 * 割り当て行から、当該試験の設問領域だけを重複なく取り出す。
 *
 * CropSubtotal には (subtotalId, cropRegionId, assignmentType) の unique がいま無く、
 * 同期のマージで同じ割り当てが2行残りうる。畳まないと配点が二重に計上される。
 *
 * 無いのは規約が禁じているからではない。規約は「uuid 以外を unique にしない」で、
 * この3列は uuid 2つと固定値の区分なので張ること自体は規約に反しない（張れば同期の
 * マージが LWW で1行へ畳む）。CropSubtotal は子を持たないので
 * docs/sync-secondary-unique-hazard.md §3 の詰まりにも当たらない。実際に張るかどうかは
 * 段階30 で判断する。
 *
 * 呼び出し側の cropRegion 型をそのまま返す（型引数で受けて返すため、配点や種別を
 * 持つ側は落とさずに受け取れる）。
 */
export function selectExamCropRegions<T extends AssignedCropRegionRef>(
  examId: string,
  questionAssignments: { cropRegion: T }[]
): T[] {
  const seenCropRegionIds = new Set<string>()
  return questionAssignments
    .map((questionAssignment) => questionAssignment.cropRegion)
    .filter((cropRegion) => cropRegion.examPage.examId === examId)
    .filter((cropRegion) => {
      if (seenCropRegionIds.has(cropRegion.id)) return false
      seenCropRegionIds.add(cropRegion.id)
      return true
    })
}
