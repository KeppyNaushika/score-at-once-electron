import { bind } from "./invoke"

/** タグ・タグ-小計グループ関連・試験タグ関連のIPC API */
export function createTagApi() {
  return {
    // Tag（タグ）
    tagGetAll: bind("tag:getAll"),
    tagCreate: bind("tag:create"),
    tagUpdate: bind("tag:update"),
    tagDelete: bind("tag:delete"),
    tagFindOrCreate: bind("tag:findOrCreate"),
    tagReorder: bind("tag:reorder"),

    // TagSubtotalGroup（タグ-小計点グループ関連）
    tagSubtotalGroupGetByTagId: bind("tagSubtotalGroup:getByTagId"),
    tagSubtotalGroupSetTags: bind("tagSubtotalGroup:setTags"),

    // ExamTag（試験-タグ関連）
    examTagGetByExamId: bind("examTag:getByExamId"),
    examTagCreate: bind("examTag:create"),
    examTagSetExamTags: bind("examTag:setExamTags"),

    // AsbDefinitionTag（解答用紙定義-タグ関連）
    asbDefinitionTagGetByDefinitionId: bind(
      "asbDefinitionTag:getByDefinitionId"
    ),
    asbDefinitionTagCreate: bind("asbDefinitionTag:create"),
    asbDefinitionTagSetDefinitionTags: bind(
      "asbDefinitionTag:setDefinitionTags"
    ),
  }
}
