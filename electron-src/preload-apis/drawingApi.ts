import type {} from "@/types/drawingAnnotation.types"

import { bind } from "./invoke"

/**
 * 描画アノテーションのIPC API（CRUD・一括作成・お気に入り・ブラウズ取得）
 *
 * ここで `Partial<DrawingAnnotation>` のような別型を書くと、同じ通信に2つの型定義が
 * できてしまい（必須のはずの列が任意になる等）、どちらが正なのか決まらなくなる。
 * 作成・更新はどちらも行そのものを渡す。
 *
 * 置き場所（採点行）は運ばない。作成・取得・行き先ごとの削除は「答案＋設問＋採点者」
 * （`AnnotationTarget`）を渡し、行が要るかどうかは main が決める。
 */
export function createDrawingApi() {
  return {
    // Drawing Annotation related
    drawing: {
      create: bind("drawing:create"),
      getByTarget: bind("drawing:getByTarget"),
      getByExamStudent: bind("drawing:getByExamStudent"),
      getByCropRegion: bind("drawing:getByCropRegion"),
      update: bind("drawing:update"),
      delete: bind("drawing:delete"),
      deleteByTarget: bind("drawing:deleteByTarget"),
      batchCreate: bind("drawing:batchCreate"),
      toggleFavorite: bind("drawing:toggleFavorite"),
      getForBrowse: bind("drawing:getForBrowse"),
    },
  }
}
