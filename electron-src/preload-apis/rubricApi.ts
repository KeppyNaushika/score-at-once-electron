import { bind } from "./invoke"

/**
 * ルーブリック採点（教員の層）の IPC API（項目・採点方式・適用・項目から計算した点）。
 * 点の計算は renderer の純粋関数（`07-score-at-once/Rubric/utils/`）で行う。
 */
export function createRubricApi() {
  return {
    rubric: {
      listItems: bind("rubric:listItems"),
      listItemsByExam: bind("rubric:listItemsByExam"),
      createItem: bind("rubric:createItem"),
      updateItem: bind("rubric:updateItem"),
      deleteItem: bind("rubric:deleteItem"),
      setScoringMethod: bind("rubric:setScoringMethod"),
      listApplications: bind("rubric:listApplications"),
      setApplications: bind("rubric:setApplications"),
      getRecalculationSource: bind("rubric:getRecalculationSource"),
      writeScores: bind("rubric:writeScores"),
    },
  }
}
