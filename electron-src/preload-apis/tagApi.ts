import { ipcRenderer } from "electron"

/** タグ・タグ-小計グループ関連・試験タグ関連のIPC API */
export function createTagApi() {
  return {
    // Tag（タグ）
    tagGetAll: () => ipcRenderer.invoke("tag:getAll"),
    tagGetById: (id: string) => ipcRenderer.invoke("tag:getById", id),
    tagCreate: (data: { name: string }) =>
      ipcRenderer.invoke("tag:create", data),
    tagUpdate: (id: string, data: { name: string }) =>
      ipcRenderer.invoke("tag:update", id, data),
    tagDelete: (id: string) => ipcRenderer.invoke("tag:delete", id),

    // TagSubtotalGroup（タグ-小計グループ関連）
    tagSubtotalGroupGetByTagId: (tagId: string) =>
      ipcRenderer.invoke("tagSubtotalGroup:getByTagId", tagId),
    tagSubtotalGroupCreate: (data: {
      tagId: string
      subtotalGroupId: string
    }) => ipcRenderer.invoke("tagSubtotalGroup:create", data),
    tagSubtotalGroupDelete: (id: string) =>
      ipcRenderer.invoke("tagSubtotalGroup:delete", id),

    // ExamTag（試験-タグ関連）
    examTagGetByExamId: (examId: string) =>
      ipcRenderer.invoke("examTag:getByExamId", examId),
    examTagCreate: (data: { examId: string; tagId: string }) =>
      ipcRenderer.invoke("examTag:create", data),
    examTagDelete: (id: string) =>
      ipcRenderer.invoke("examTag:delete", id),
    examTagSetExamTags: (examId: string, tagIds: string[]) =>
      ipcRenderer.invoke("examTag:setExamTags", examId, tagIds),
  }
}
