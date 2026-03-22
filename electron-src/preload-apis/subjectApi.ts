import { ipcRenderer } from "electron"

/** 教科・教科-小計グループ関連のIPC API（教科CRUD・小計グループとの紐付け管理） */
export function createSubjectApi() {
  return {
    // Subject（教科）
    subjectGetAll: () => ipcRenderer.invoke("subject:getAll"),
    subjectGetById: (id: string) => ipcRenderer.invoke("subject:getById", id),
    subjectCreate: (data: { name: string }) =>
      ipcRenderer.invoke("subject:create", data),
    subjectUpdate: (id: string, data: { name: string }) =>
      ipcRenderer.invoke("subject:update", id, data),
    subjectDelete: (id: string) => ipcRenderer.invoke("subject:delete", id),

    // SubjectSubtotalGroup（教科-小計グループ関連）
    subjectSubtotalGroupGetBySubjectId: (subjectId: string) =>
      ipcRenderer.invoke("subjectSubtotalGroup:getBySubjectId", subjectId),
    subjectSubtotalGroupCreate: (data: {
      subjectId: string
      subtotalGroupId: string
    }) => ipcRenderer.invoke("subjectSubtotalGroup:create", data),
    subjectSubtotalGroupDelete: (id: string) =>
      ipcRenderer.invoke("subjectSubtotalGroup:delete", id),
  }
}
