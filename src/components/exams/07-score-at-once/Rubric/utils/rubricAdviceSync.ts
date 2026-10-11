/**
 * 助言の朱書きの差分（どの答案のどの朱書きを作る・直す・消すか。docs/vlm-grading-design.md §4-7）。
 *
 * renderer の純粋関数。採点行ごとに、当たっている項目と決まりから朱書きの文を決め
 * （`resolveRubricAdvice`）、その行に今ある**助言の朱書き（`isRubricAdvice`）だけ**と比べる。
 * 手で書いた文字の注釈は、置き場所で避けるためにだけ使い、作る・直す・消すの対象にはしない
 * （main も印の無い注釈には触らない）。
 *
 * - 文が無い（助言のある項目が無い・朱書きなし・未決定）: 助言の朱書きを消す
 * - 文があり、朱書きが無い: 占有グリッドで空いている場所に作る（その行のほかの文字の注釈も避ける）
 * - 文があり、朱書きがある: 文か作った項目（`rubricItemId`）が違えば書き換える。今の位置・文字の大きさで枠に収まり手書きに重ならなければ
 *   位置と大きさを保ち、収まらなければ置き直す（`replaceAdviceAnnotationText`）。
 *   同期で2つ以上できていれば、古いものを残して残りを消す
 */

import type { DrawingAnnotation } from "@/types/drawingAnnotation.types"

import {
  normalizeAdviceText,
  type ReplacedAdviceAnnotation,
} from "./adviceAnnotationPlacement"
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
  /**
   * その行の文字の注釈（古い順）。助言の朱書きと、手で書いた文字の注釈（置き場所で避けるだけ）。
   * 文字でない注釈は入れなくてよい
   */
  drawingAnnotations: readonly DrawingAnnotation[]
}

interface PlanRubricAdviceSyncInput<Row extends AdviceSyncRow> {
  /** 差分を求める採点行（どの行を見るかは呼び出し側が決める） */
  rows: readonly Row[]
  rubricItems: readonly AdviceRubricItem[]
  combinations: readonly AdviceCombinationRule[]
  /**
   * 朱書きを新しく置く（置けなければ null）。`occupyingAnnotations` はその行のほかの文字の注釈（避ける）
   */
  place: (
    row: Row,
    adviceText: string,
    occupyingAnnotations: readonly DrawingAnnotation[]
  ) => DrawingAnnotation | null
  /** 置いてある朱書きの文を書き換えるときの、改行を入れた文と位置・文字の大きさ */
  replace: (
    row: Row,
    annotation: DrawingAnnotation,
    adviceText: string,
    occupyingAnnotations: readonly DrawingAnnotation[]
  ) => ReplacedAdviceAnnotation
}

/** 助言の朱書きの差分（main の `syncRubricAdviceAnnotations` に渡す形） */
export interface RubricAdviceSyncPlan {
  creates: { questionScoreId: string; annotation: DrawingAnnotation }[]
  updates: ({
    drawingAnnotationId: string
    rubricItemId: string | null
  } & ReplacedAdviceAnnotation)[]
  deletes: string[]
}

export function planRubricAdviceSync<Row extends AdviceSyncRow>({
  rows,
  rubricItems,
  combinations,
  place,
  replace,
}: PlanRubricAdviceSyncInput<Row>): RubricAdviceSyncPlan {
  const plan: RubricAdviceSyncPlan = { creates: [], updates: [], deletes: [] }
  rows.forEach((row) => {
    const adviceAnnotations = row.drawingAnnotations.filter(
      (drawingAnnotation) => drawingAnnotation.isRubricAdvice
    )
    // 助言の朱書きは、置く・書き換えるもの1つ以外は消すので、避けるのは手で書いた文字の注釈だけ
    const occupyingAnnotations = row.drawingAnnotations.filter(
      (drawingAnnotation) =>
        !drawingAnnotation.isRubricAdvice && drawingAnnotation.type === "text"
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
      const annotation = place(row, resolution.text, occupyingAnnotations)
      if (annotation) {
        plan.creates.push({
          questionScoreId: row.id,
          annotation: { ...annotation, rubricItemId: resolution.rubricItemId },
        })
      }
      return
    }
    const isSameText =
      normalizeAdviceText(kept.text) === normalizeAdviceText(resolution.text)
    if (isSameText && kept.rubricItemId === resolution.rubricItemId) return
    plan.updates.push({
      drawingAnnotationId: kept.id,
      rubricItemId: resolution.rubricItemId,
      // 文が同じで作った項目だけが違えば、位置も文も今のまま
      ...(isSameText
        ? { text: kept.text, x: kept.x, y: kept.y, fontSize: kept.fontSize }
        : replace(row, kept, resolution.text, occupyingAnnotations)),
    })
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
