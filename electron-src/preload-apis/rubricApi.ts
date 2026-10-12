import { bind } from "./invoke"

/**
 * ルーブリック採点（教員の層）の IPC API（項目・採点方式・類型評価のルーブリック・適用・項目から計算した点・
 * 重なった助言の決まり・助言の朱書き・朱書きの配置に使う占有グリッド）。
 * 点の計算は renderer の純粋関数（`07-score-at-once/Rubric/utils/`）で行う。
 */
export function createRubricApi() {
  return {
    rubric: {
      listItems: bind("rubric:listItems"),
      createItem: bind("rubric:createItem"),
      updateItem: bind("rubric:updateItem"),
      deleteItem: bind("rubric:deleteItem"),
      setScoringMethod: bind("rubric:setScoringMethod"),
      listScoreScales: bind("rubric:listScoreScales"),
      createScoreScale: bind("rubric:createScoreScale"),
      updateScoreScale: bind("rubric:updateScoreScale"),
      setScoreScaleExam: bind("rubric:setScoreScaleExam"),
      duplicateScoreScale: bind("rubric:duplicateScoreScale"),
      deleteScoreScale: bind("rubric:deleteScoreScale"),
      createScoreScaleLevel: bind("rubric:createScoreScaleLevel"),
      updateScoreScaleLevel: bind("rubric:updateScoreScaleLevel"),
      reorderScoreScaleLevels: bind("rubric:reorderScoreScaleLevels"),
      deleteScoreScaleLevel: bind("rubric:deleteScoreScaleLevel"),
      setCropRegionScoreScale: bind("rubric:setCropRegionScoreScale"),
      listApplications: bind("rubric:listApplications"),
      setApplications: bind("rubric:setApplications"),
      getRecalculationSource: bind("rubric:getRecalculationSource"),
      writeScores: bind("rubric:writeScores"),
      listAdviceCombinations: bind("rubric:listAdviceCombinations"),
      saveAdviceCombination: bind("rubric:saveAdviceCombination"),
      deleteAdviceCombination: bind("rubric:deleteAdviceCombination"),
      getAdviceSource: bind("rubric:getAdviceSource"),
      syncAdviceAnnotations: bind("rubric:syncAdviceAnnotations"),
      measureInk: bind("rubric:measureInk"),
    },
  }
}
