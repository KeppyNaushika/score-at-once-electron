import { ipcRenderer } from "electron"

/** タグ・タグ-小計グループ関連・試験タグ関連のIPC API */
export function createTagApi() {
  return {
    // Tag（タグ）
    tagGetAll: () => ipcRenderer.invoke("tag:getAll"),
    tagGetById: (id: string) => ipcRenderer.invoke("tag:getById", id),
    tagCreate: (data: { name: string; color?: string }) =>
      ipcRenderer.invoke("tag:create", data),
    tagUpdate: (id: string, data: { name?: string; color?: string | null }) =>
      ipcRenderer.invoke("tag:update", id, data),
    tagDelete: (id: string) => ipcRenderer.invoke("tag:delete", id),
    tagFindOrCreate: (name: string) =>
      ipcRenderer.invoke("tag:findOrCreate", name),
    tagReorder: (tagIds: string[]) => ipcRenderer.invoke("tag:reorder", tagIds),

    // TagSubtotalGroup（タグ-小計点グループ関連）
    tagSubtotalGroupGetByTagId: (tagId: string) =>
      ipcRenderer.invoke("tagSubtotalGroup:getByTagId", tagId),
    tagSubtotalGroupSetTags: (subtotalGroupId: string, tagIds: string[]) =>
      ipcRenderer.invoke("tagSubtotalGroup:setTags", subtotalGroupId, tagIds),

    // ExamTag（試験-タグ関連）
    examTagGetByExamId: (examId: string) =>
      ipcRenderer.invoke("examTag:getByExamId", examId),
    examTagCreate: (data: { examId: string; tagId: string }) =>
      ipcRenderer.invoke("examTag:create", data),
    examTagDelete: (id: string) => ipcRenderer.invoke("examTag:delete", id),
    examTagSetExamTags: (examId: string, tagIds: string[]) =>
      ipcRenderer.invoke("examTag:setExamTags", examId, tagIds),

    // AsbDefinitionTag（解答用紙定義-タグ関連）
    asbDefinitionTagGetByDefinitionId: (asbDefinitionId: string) =>
      ipcRenderer.invoke("asbDefinitionTag:getByDefinitionId", asbDefinitionId),
    asbDefinitionTagCreate: (data: {
      asbDefinitionId: string
      tagId: string
    }) => ipcRenderer.invoke("asbDefinitionTag:create", data),
    asbDefinitionTagDelete: (id: string) =>
      ipcRenderer.invoke("asbDefinitionTag:delete", id),
    asbDefinitionTagSetDefinitionTags: (
      asbDefinitionId: string,
      tagIds: string[]
    ) =>
      ipcRenderer.invoke(
        "asbDefinitionTag:setDefinitionTags",
        asbDefinitionId,
        tagIds
      ),
  }
}
