import type {} from "@/types/drawingAnnotation.types"

import { bind } from "./invoke"

/**
 * 描画アノテーションのIPC API（CRUD・一括作成・お気に入り・ブラウズ取得）
 *
 * ここで `Partial<DrawingAnnotation>` のような別型を書くと、同じ通信に2つの型定義が
 * できてしまい（必須のはずの questionScoreId が任意になる等）、どちらが正なのか
 * 決まらなくなる。作成・更新はどちらも行そのものを渡す。
 */
export function createDrawingApi() {
  return {
    // Drawing Annotation related
    drawing: {
      create: bind("drawing:create"),
      getByQuestionScore: bind("drawing:getByQuestionScore"),
      getByExamStudent: bind("drawing:getByExamStudent"),
      getByCropRegion: bind("drawing:getByCropRegion"),
      update: bind("drawing:update"),
      delete: bind("drawing:delete"),
      deleteByQuestionScore: bind("drawing:deleteByQuestionScore"),
      batchCreate: bind("drawing:batchCreate"),
      toggleFavorite: bind("drawing:toggleFavorite"),
      getForBrowse: bind("drawing:getForBrowse"),
    },
  }
}
