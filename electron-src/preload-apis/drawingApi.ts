import { ipcRenderer } from "electron"

import type {
  DrawingCreateData,
  DrawingType,
  DrawingUpdateData,
} from "@/types/drawingAnnotation.types"

/**
 * 描画アノテーションのIPC API（CRUD・一括作成・お気に入り・ブラウズ取得）
 *
 * 引数の型は契約（`src/types/electron/drawingApi.d.ts`）と同一のものを参照する。
 * ここで `Partial<DrawingAnnotation>` のような別型を書くと、同じ通信に2つの型定義が
 * できてしまい（必須のはずの questionScoreId / userId が任意になる等）、どちらが
 * 正なのか決まらなくなる。
 */
export function createDrawingApi() {
  return {
    // Drawing Annotation related
    drawing: {
      create: (data: DrawingCreateData) =>
        ipcRenderer.invoke("drawing:create", data),
      getByQuestionScore: (questionScoreId: string, type?: DrawingType) =>
        ipcRenderer.invoke("drawing:getByQuestionScore", questionScoreId, type),
      getByExamStudent: (
        examStudentId: string,
        type?: DrawingType,
        userId?: string
      ) =>
        ipcRenderer.invoke(
          "drawing:getByExamStudent",
          examStudentId,
          type,
          userId
        ),
      getByCropRegion: (cropRegionId: string, userId?: string) =>
        ipcRenderer.invoke("drawing:getByCropRegion", cropRegionId, userId),
      update: (id: string, data: DrawingUpdateData) =>
        ipcRenderer.invoke("drawing:update", id, data),
      delete: (id: string) => ipcRenderer.invoke("drawing:delete", id),
      deleteByQuestionScore: (questionScoreId: string, type?: DrawingType) =>
        ipcRenderer.invoke(
          "drawing:deleteByQuestionScore",
          questionScoreId,
          type
        ),
      batchCreate: (annotations: DrawingCreateData[]) =>
        ipcRenderer.invoke("drawing:batchCreate", annotations),
      toggleFavorite: (id: string, isFavorite: boolean) =>
        ipcRenderer.invoke("drawing:toggleFavorite", id, isFavorite),
      getForBrowse: (examId: string) =>
        ipcRenderer.invoke("drawing:getForBrowse", examId),
    },
  }
}
