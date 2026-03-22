import type { DrawingAnnotation } from "@prisma/client"
import { ipcRenderer } from "electron"

/** 描画アノテーションのIPC API（CRUD・一括操作・お気に入り・統計取得） */
export function createDrawingApi() {
  return {
    // Drawing Annotation related
    drawing: {
      create: (data: Partial<DrawingAnnotation>) =>
        ipcRenderer.invoke("drawing:create", data),
      getByQuestionScore: (
        questionScoreId: string,
        type?: string,
        userId?: string
      ) =>
        ipcRenderer.invoke(
          "drawing:getByQuestionScore",
          questionScoreId,
          type,
          userId
        ),
      getByStudent: (
        studentId: string,
        examId: string,
        type?: string,
        userId?: string
      ) =>
        ipcRenderer.invoke(
          "drawing:getByStudent",
          studentId,
          examId,
          type,
          userId
        ),
      getByExam: (examId: string, type?: string, userId?: string) =>
        ipcRenderer.invoke("drawing:getByExam", examId, type, userId),
      getByCropRegion: (cropRegionId: string, userId?: string) =>
        ipcRenderer.invoke("drawing:getByCropRegion", cropRegionId, userId),
      update: (id: string, data: Partial<DrawingAnnotation>) =>
        ipcRenderer.invoke("drawing:update", id, data),
      delete: (id: string) => ipcRenderer.invoke("drawing:delete", id),
      deleteByQuestionScore: (questionScoreId: string, type?: string) =>
        ipcRenderer.invoke(
          "drawing:deleteByQuestionScore",
          questionScoreId,
          type
        ),
      batchCreate: (annotations: Partial<DrawingAnnotation>[]) =>
        ipcRenderer.invoke("drawing:batchCreate", annotations),
      batchUpdate: (
        updates: Array<{ id: string; data: Partial<DrawingAnnotation> }>
      ) => ipcRenderer.invoke("drawing:batchUpdate", updates),
      getStats: (questionScoreId: string) =>
        ipcRenderer.invoke("drawing:getStats", questionScoreId),
      getById: (id: string) => ipcRenderer.invoke("drawing:getById", id),
      toggleFavorite: (id: string, isFavorite: boolean) =>
        ipcRenderer.invoke("drawing:toggleFavorite", id, isFavorite),
      getForBrowse: (examId: string) =>
        ipcRenderer.invoke("drawing:getForBrowse", examId),
    },
  }
}
