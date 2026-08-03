import { ipcRenderer } from "electron"

import type {
  DrawingAnnotation,
  DrawingType,
} from "@/types/drawingAnnotation.types"

/**
 * 描画アノテーションのIPC API（CRUD・一括作成・お気に入り・ブラウズ取得）
 *
 * 引数の型は契約（`src/types/electron/drawingApi.d.ts`）と同一のものを参照する。
 * ここで `Partial<DrawingAnnotation>` のような別型を書くと、同じ通信に2つの型定義が
 * できてしまい（必須のはずの questionScoreId が任意になる等）、どちらが正なのか
 * 決まらなくなる。作成・更新はどちらも行そのものを渡す。
 */
export function createDrawingApi() {
  return {
    // Drawing Annotation related
    drawing: {
      create: (annotation: DrawingAnnotation) =>
        ipcRenderer.invoke("drawing:create", annotation),
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
      update: (annotation: DrawingAnnotation) =>
        ipcRenderer.invoke("drawing:update", annotation),
      delete: (id: string) => ipcRenderer.invoke("drawing:delete", id),
      deleteByQuestionScore: (questionScoreId: string, type?: DrawingType) =>
        ipcRenderer.invoke(
          "drawing:deleteByQuestionScore",
          questionScoreId,
          type
        ),
      batchCreate: (annotations: DrawingAnnotation[]) =>
        ipcRenderer.invoke("drawing:batchCreate", annotations),
      toggleFavorite: (id: string, isFavorite: boolean) =>
        ipcRenderer.invoke("drawing:toggleFavorite", id, isFavorite),
      getForBrowse: (examId: string) =>
        ipcRenderer.invoke("drawing:getForBrowse", examId),
    },
  }
}
