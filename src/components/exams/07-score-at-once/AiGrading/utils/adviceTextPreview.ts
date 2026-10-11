/**
 * 問いかけの助言の欄の文を、中央の一覧のいまの問いの答案に朱書きとして下見する
 * （docs/vlm-grading-design.md §3-5・§9）。renderer の純粋関数。
 *
 * **ほかの注釈は変えない。** 手で書いた注釈も、ほかの項目の助言の朱書きも、保存したまま描く。
 * 答案ごとに次のどちらかだけをする:
 *
 * - この案が書き換える朱書きがある答案: その朱書きを欄の文に差し替える。今の位置・大きさで収まれば
 *   そのまま、収まらなければ置き直す（`replaceAdviceAnnotationText`）。欄が空なら隠す（確定すると消えるので）
 * - それ以外の答案: 欄の文の朱書きを新しく足す（`placeAdviceAnnotation`）。欄が空なら何も足さない
 *
 * 「この案が書き換える朱書き」は、案に当たる項目（既存の項目に当たる案・前に確定してできた項目）があり、
 * 答案の助言の朱書きの文がその項目の今の助言と同じもの。助言の朱書きは採点行ごとに1つで、当たっている
 * 項目の助言から作る（§4-7）ので、文が項目の助言そのものなら、その項目だけから作った朱書きである
 * （重なった助言をまとめた文や、教員が手で直した文は、この案の文を直しても書き換わらないので残す）。
 *
 * 置く・置き直す場所は、手書きに加えて、その答案のほかの文字の注釈も避ける（差し替える朱書きそのものは除く）。
 * ほかの項目の助言と並べる・重なった助言の決まりは下見では効かせず、確定のときに効く。
 */

import type { AnswerInkGrid } from "@/lib/shared/aiGrading/answerInkGrid"
import {
  type DrawingAnnotation,
  newDrawingAnnotation,
} from "@/types/drawingAnnotation.types"

import {
  normalizeAdviceText,
  placeAdviceAnnotation,
  replaceAdviceAnnotationText,
} from "../../Rubric/utils/adviceAnnotationPlacement"

/** 下見する問い（いまの問いの答案と、欄の文） */
export interface AdviceTextPreviewRequest {
  /** 問いの id（問いが変わったことを見分ける） */
  stepId: string
  adviceText: string
  /**
   * 案に当たる項目の今の助言（`QuestioningAdvice.rubricItemAdviceText`）。この文そのものの助言の朱書きを
   * 欄の文に差し替える。項目が無ければ null（差し替えず、足すだけ）
   */
  rubricItemAdviceText: string | null
  examStudentIds: readonly string[]
}

interface BuildAdviceTextPreviewInput {
  request: AdviceTextPreviewRequest
  /** 受験者 → この設問の占有グリッド（測れなかった答案は無い） */
  inkGridByExamStudentId: ReadonlyMap<string, AnswerInkGrid>
  /** 受験者 → 自分の採点行の注釈（印の無い注釈・文字でない注釈も入っていてよい） */
  savedAnnotationsByExamStudentId: ReadonlyMap<
    string,
    readonly DrawingAnnotation[]
  >
  region: { x: number; y: number; width: number; height: number }
  pageSize: string
}

/** 答案の助言の朱書きのうち、この案が書き換えるもの（無ければ undefined） */
function findRewrittenAdvice(
  savedAnnotations: readonly DrawingAnnotation[],
  rubricItemAdviceText: string | null
): DrawingAnnotation | undefined {
  if (rubricItemAdviceText === null) return undefined
  const itemAdvice = normalizeAdviceText(rubricItemAdviceText)
  if (itemAdvice === "") return undefined
  return savedAnnotations.find(
    (annotation) =>
      annotation.isRubricAdvice &&
      normalizeAdviceText(annotation.text) === itemAdvice
  )
}

/**
 * 受験者 → 下見で描く助言の朱書き（問いの答案だけ）。一覧は、保存した助言の朱書きの代わりにこれを描く
 * （`previewRubricAdviceOf` の約束）ので、残すほかの助言の朱書きも保存したまま入れる。手で書いた注釈は
 * 一覧が保存したまま描く
 */
export function buildAdviceTextPreview({
  request,
  inkGridByExamStudentId,
  savedAnnotationsByExamStudentId,
  region,
  pageSize,
}: BuildAdviceTextPreviewInput): Map<string, DrawingAnnotation[]> {
  const isEmpty = request.adviceText.trim() === ""
  return new Map(
    request.examStudentIds.map(
      (examStudentId): [string, DrawingAnnotation[]] => {
        const savedAnnotations =
          savedAnnotationsByExamStudentId.get(examStudentId) ?? []
        const rewritten = findRewrittenAdvice(
          savedAnnotations,
          request.rubricItemAdviceText
        )
        const keptAdvice = savedAnnotations.filter(
          (annotation) => annotation.isRubricAdvice && annotation !== rewritten
        )
        if (isEmpty) return [examStudentId, keptAdvice]
        const context = {
          inkGrid: inkGridByExamStudentId.get(examStudentId) ?? null,
          region,
          pageSize,
          occupyingAnnotations: savedAnnotations.filter(
            (annotation) =>
              annotation.type === "text" && annotation !== rewritten
          ),
        }
        if (!rewritten) {
          const placed = placeAdviceAnnotation(request.adviceText, context)
          return [examStudentId, placed ? [...keptAdvice, placed] : keptAdvice]
        }
        const replaced = replaceAdviceAnnotationText(
          request.adviceText,
          rewritten,
          context
        )
        return [
          examStudentId,
          [
            ...keptAdvice,
            newDrawingAnnotation({
              type: "text",
              ...replaced,
              color: rewritten.color,
              strokeWidth: rewritten.strokeWidth,
              anchorDirection: rewritten.anchorDirection,
              isRubricAdvice: true,
            }),
          ],
        ]
      }
    )
  )
}
