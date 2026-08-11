import type {
  DrawingAnnotation,
  DrawingType,
} from "@/types/drawingAnnotation.types"

import { invoke } from "./invoke"

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
        invoke("drawing:create", annotation),
      getByQuestionScore: (questionScoreId: string, type?: DrawingType) =>
        invoke("drawing:getByQuestionScore", questionScoreId, type),
      getByExamStudent: (
        examStudentId: string,
        type?: DrawingType,
        userId?: string
      ) => invoke("drawing:getByExamStudent", examStudentId, type, userId),
      getByCropRegion: (cropRegionId: string, userId?: string) =>
        invoke("drawing:getByCropRegion", cropRegionId, userId),
      update: (annotation: DrawingAnnotation) =>
        invoke("drawing:update", annotation),
      delete: (id: string) => invoke("drawing:delete", id),
      deleteByQuestionScore: (questionScoreId: string, type?: DrawingType) =>
        invoke("drawing:deleteByQuestionScore", questionScoreId, type),
      batchCreate: (annotations: DrawingAnnotation[]) =>
        invoke("drawing:batchCreate", annotations),
      toggleFavorite: (id: string, isFavorite: boolean) =>
        invoke("drawing:toggleFavorite", id, isFavorite),
      getForBrowse: (examId: string) => invoke("drawing:getForBrowse", examId),
    },
  }
}
