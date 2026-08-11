import type {} from "../../src/types/answerWhiteness.types"
import type {} from "../../src/types/electron/scoringApi"
import { bind } from "./invoke"

/** 採点スコアのIPC API（設問スコアCRUD・一括更新・確定・採点担当割当） */
export function createScoringApi() {
  return {
    // QuestionScore related functions
    getQuestionScore: bind("get-question-score"),
    getQuestionScoresForExam: bind("get-question-scores-for-exam"),
    createQuestionScore: bind("create-question-score"),
    updateQuestionScore: bind("update-question-score"),
    finalizeQuestionScore: bind("finalize-question-score"),
    getExamDecisionSummary: bind("get-exam-decision-summary"),
    getCropRegionAssignments: bind("get-crop-region-assignments"),
    assignCropRegion: bind("assign-crop-region"),
    unassignCropRegion: bind("unassign-crop-region"),
    batchUpdateQuestionScores: bind("batch-update-question-scores"),
    measureAnswerWhiteness: bind("measure-answer-whiteness"),
  }
}
