/**
 * 解答用紙の木から実体を引く。
 */

import type {
  AnswerSheetDefinition,
  AsbCellParent,
  BranchQuestion,
  SubQuestion,
} from "@/types/answerSheetDefinition.types"

/** 並びの中での位置つきで引いた実体（隣を見る操作に要る） */
interface QuestionPosition<TQuestion> {
  question: TQuestion
  siblings: TQuestion[]
  index: number
}

export function findSubQuestion(
  definition: AnswerSheetDefinition,
  subQuestionId: string
): QuestionPosition<SubQuestion> | null {
  for (const majorQuestion of definition.majorQuestions) {
    const index = majorQuestion.subQuestions.findIndex(
      (subQuestion) => subQuestion.id === subQuestionId
    )
    if (index === -1) continue
    return {
      question: majorQuestion.subQuestions[index],
      siblings: majorQuestion.subQuestions,
      index,
    }
  }
  return null
}

export function findBranchQuestion(
  definition: AnswerSheetDefinition,
  branchQuestionId: string
): QuestionPosition<BranchQuestion> | null {
  for (const subQuestion of allSubQuestions(definition)) {
    const index = subQuestion.branchQuestions.findIndex(
      (branchQuestion) => branchQuestion.id === branchQuestionId
    )
    if (index === -1) continue
    return {
      question: subQuestion.branchQuestions[index],
      siblings: subQuestion.branchQuestions,
      index,
    }
  }
  return null
}

export function allSubQuestions(
  definition: AnswerSheetDefinition
): SubQuestion[] {
  return definition.majorQuestions.flatMap(
    (majorQuestion) => majorQuestion.subQuestions
  )
}

/** 解答を書くセル（小問と枝問）を並べる。中身はどちらも同じ形で持つ */
export function allCells(
  definition: AnswerSheetDefinition
): (SubQuestion | BranchQuestion)[] {
  return allSubQuestions(definition).flatMap((subQuestion) => [
    subQuestion,
    ...subQuestion.branchQuestions,
  ])
}

/** 親の指し方（小問か枝問か）からセルを引く */
export function findCell(
  definition: AnswerSheetDefinition,
  parent: AsbCellParent
): SubQuestion | BranchQuestion | undefined {
  if ("subQuestionId" in parent) {
    return allSubQuestions(definition).find(
      (subQuestion) => subQuestion.id === parent.subQuestionId
    )
  }
  return findBranchQuestion(definition, parent.branchQuestionId)?.question
}
