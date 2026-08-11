import { invoke } from "./invoke"

/** タグ・タグ-小計グループ関連・試験タグ関連のIPC API */
export function createTagApi() {
  return {
    // Tag（タグ）
    tagGetAll: () => invoke("tag:getAll"),
    tagCreate: (data: { name: string; color?: string }) =>
      invoke("tag:create", data),
    tagUpdate: (id: string, data: { name?: string; color?: string | null }) =>
      invoke("tag:update", id, data),
    tagDelete: (id: string) => invoke("tag:delete", id),
    tagFindOrCreate: (name: string) => invoke("tag:findOrCreate", name),
    tagReorder: (tagIds: string[]) => invoke("tag:reorder", tagIds),

    // TagSubtotalGroup（タグ-小計点グループ関連）
    tagSubtotalGroupGetByTagId: (tagId: string) =>
      invoke("tagSubtotalGroup:getByTagId", tagId),
    tagSubtotalGroupSetTags: (subtotalGroupId: string, tagIds: string[]) =>
      invoke("tagSubtotalGroup:setTags", subtotalGroupId, tagIds),

    // ExamTag（試験-タグ関連）
    examTagGetByExamId: (examId: string) =>
      invoke("examTag:getByExamId", examId),
    examTagCreate: (data: { examId: string; tagId: string }) =>
      invoke("examTag:create", data),
    examTagSetExamTags: (examId: string, tagIds: string[]) =>
      invoke("examTag:setExamTags", examId, tagIds),

    // AsbDefinitionTag（解答用紙定義-タグ関連）
    asbDefinitionTagGetByDefinitionId: (asbDefinitionId: string) =>
      invoke("asbDefinitionTag:getByDefinitionId", asbDefinitionId),
    asbDefinitionTagCreate: (data: {
      asbDefinitionId: string
      tagId: string
    }) => invoke("asbDefinitionTag:create", data),
    asbDefinitionTagSetDefinitionTags: (
      asbDefinitionId: string,
      tagIds: string[]
    ) => invoke("asbDefinitionTag:setDefinitionTags", asbDefinitionId, tagIds),
  }
}
