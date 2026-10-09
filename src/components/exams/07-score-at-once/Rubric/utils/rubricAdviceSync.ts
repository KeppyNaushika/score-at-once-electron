/**
 * 助言の朱書きの差分（どの答案のどの朱書きを作る・直す・消すか。docs/vlm-grading-design.md §4-7）。
 *
 * renderer の純粋関数。採点行ごとに、当たっている項目と決まりから朱書きの文を決め
 * （`resolveRubricAdvice`）、その行に今ある**助言の朱書き（`isRubricAdvice`）だけ**と比べる。
 * 手で書いた注釈は材料に入れない（main も印の無い注釈には触らない）。
 *
 * - 文が無い（助言のある項目が無い・朱書きなし・未決定）: 助言の朱書きを消す
 * - 文があり、朱書きが無い: 占有グリッドで空いている場所に作る
 * - 文があり、朱書きがある: 文が違えば文だけを書き換える（位置と文字の大きさは保つ）。
 *   同期で2つ以上できていれば、古いものを残して残りを消す
 */

import type { DrawingAnnotation } from "@/types/drawingAnnotation.types"

import { normalizeAdviceText } from "./adviceAnnotationPlacement"
import {
  type AdviceCombinationRule,
  type AdviceRubricItem,
  resolveRubricAdvice,
} from "./rubricAdviceText"

/** 差分を求める採点行（適用と、その行の助言の朱書き） */
export interface AdviceSyncRow {
  /** QuestionScore.id */
  id: string
  examStudentId: string
  rubricApplications: readonly { rubricItemId: string }[]
  /** その行の助言の朱書き（古い順）。印の無い注釈は入れない */
  drawingAnnotations: readonly DrawingAnnotation[]
}

interface PlanRubricAdviceSyncInput<Row extends AdviceSyncRow> {
  /** 差分を求める採点行（どの行を見るかは呼び出し側が決める） */
  rows: readonly Row[]
  rubricItems: readonly AdviceRubricItem[]
  combinations: readonly AdviceCombinationRule[]
  /** 朱書きを新しく置く（置けなければ null） */
  place: (row: Row, adviceText: string) => DrawingAnnotation | null
  /** 置いてある朱書きの文を書き換えるときの、改行を入れた文 */
  rewrap: (
    row: Row,
    annotation: DrawingAnnotation,
    adviceText: string
  ) => string
}

/** 助言の朱書きの差分（main の `syncRubricAdviceAnnotations` に渡す形） */
export interface RubricAdviceSyncPlan {
  creates: { questionScoreId: string; annotation: DrawingAnnotation }[]
  updates: { drawingAnnotationId: string; text: string }[]
  deletes: string[]
}

export function planRubricAdviceSync<Row extends AdviceSyncRow>({
  rows,
  rubricItems,
  combinations,
  place,
  rewrap,
}: PlanRubricAdviceSyncInput<Row>): RubricAdviceSyncPlan {
  const plan: RubricAdviceSyncPlan = { creates: [], updates: [], deletes: [] }
  rows.forEach((row) => {
    const adviceAnnotations = row.drawingAnnotations.filter(
      (drawingAnnotation) => drawingAnnotation.isRubricAdvice
    )
    const resolution = resolveRubricAdvice(
      row.rubricApplications.map((application) => application.rubricItemId),
      rubricItems,
      combinations
    )
    if (resolution.kind !== "text") {
      plan.deletes.push(
        ...adviceAnnotations.map((drawingAnnotation) => drawingAnnotation.id)
      )
      return
    }

    const [kept, ...extras] = adviceAnnotations
    plan.deletes.push(
      ...extras.map((drawingAnnotation) => drawingAnnotation.id)
    )
    if (!kept) {
      const annotation = place(row, resolution.text)
      if (annotation) plan.creates.push({ questionScoreId: row.id, annotation })
      return
    }
    if (
      normalizeAdviceText(kept.text) !== normalizeAdviceText(resolution.text)
    ) {
      plan.updates.push({
        drawingAnnotationId: kept.id,
        text: rewrap(row, kept, resolution.text),
      })
    }
  })
  return plan
}

/** 書くものが無いか */
export function isEmptyAdviceSyncPlan(plan: RubricAdviceSyncPlan): boolean {
  return (
    plan.creates.length === 0 &&
    plan.updates.length === 0 &&
    plan.deletes.length === 0
  )
}
