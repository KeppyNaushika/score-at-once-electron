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
 * **畳むのは、小計点グループの中の複数の小計に同じ設問が割り当てられるため。**
 * グループ内は OR（どれかに割り当たっていれば1回数える）なので、複数の小計の
 * 割り当てを束ねて渡す呼び出し（computeCropRegionSubtotalScore）では同じ設問領域が
 * 何度も現れる。畳まないと配点が二重に計上される。
 *
 * 1つの小計の割り当てだけを渡す呼び出しでは、そもそも重複しない
 * （CropSubtotal は 2026-08-23 に `(cropRegionId, subtotalId, assignmentType)` の
 * unique を張ったので、同じ小計に同じ設問が2行付くことは無い）。
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
