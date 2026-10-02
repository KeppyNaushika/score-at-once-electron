/**
 * 成績算出（Grade）で使われている試験・資料のロックを解除する前の、確認の文言。
 *
 * 材料は試験・資料1件を使っているデータソースの一覧（詳細の include から
 * `examUsingDataSources` / `courseworkUsingDataSources` で導いたもの）。空ならロックしない。
 * ロックそのもの（書き込みを止める・解除を覚える）は `src/lib/gradeWriteLock.ts` と
 * `GradeLockProvider` が持つ。
 */

import type { UsingGradeDataSource } from "@/lib/shared/gradeReferenceMessages"

/**
 * ロックを解除する前の確認の文言。
 *
 * 使っているデータソースは成績算出ごとにまとめる。1行ずつ文にすると成績算出名が
 * 毎行くり返されて読みにくいので、表にして見せる。成績算出も行も、渡された順。
 *
 * @param subject ロックしているものを言う主語（「この試験」など）
 */
export function buildGradeLockMessage(
  subject: string,
  dataSources: UsingGradeDataSource[]
) {
  const groups = new Map<
    string,
    {
      grade: UsingGradeDataSource["gradeItem"]["grade"]
      dataSources: UsingGradeDataSource[]
    }
  >()
  for (const dataSource of dataSources) {
    const grade = dataSource.gradeItem.grade
    const group = groups.get(grade.id)
    if (group === undefined) {
      groups.set(grade.id, { grade, dataSources: [dataSource] })
    } else {
      group.dataSources.push(dataSource)
    }
  }
  return {
    /** 何がどう使われていて、変えると何が起きるか */
    lead: `${subject}は、次の成績算出で使われています。変えると、その成績の点数が変わります。`,
    groups: [...groups.values()],
    /**
     * 確定済みの評価項目があるときの注意。無ければ null（確定の話は出さない。
     * 出すと、確定済みの値があって守られるかのように読めるため）
     */
    frozenNote: dataSources.some(isFrozenDataSource)
      ? "「確定済み」の評価項目は、確定した値のまま変わりません。元データを変えると、成績算出に「確定後に元データが変わっています」と表示されます。"
      : null,
  }
}

/** その評価項目を成績算出で確定済みか（1人でも） */
export function isFrozenDataSource(dataSource: UsingGradeDataSource): boolean {
  return dataSource.gradeItem.frozenScores.length > 0
}
