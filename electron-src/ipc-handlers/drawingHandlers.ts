/**
 * @fileoverview 描画アノテーション IPCハンドラー
 * @description フロントエンド↔バックエンド間の描画アノテーション通信
 */

import type {
  AnnotationTarget,
  DrawingAnnotation,
  DrawingType,
} from "../../src/types/drawingAnnotation.types"
import * as drawingService from "../lib/prisma/drawingAnnotation"
import { type HandlerMap } from "./ipcHandlerUtils"

/**
 * 描画アノテーション関連のIPCハンドラーを設定する
 * 全ての描画ツール（テキスト・直線・長方形・楕円）に対応
 *
 * 口が運ぶのは意図（「この答案のこの設問に、この採点者が描いた」）で、置き場所の
 * 採点行は main が用意する。renderer は `questionScoreId` を知らないし、要らない。
 */
export const drawingHandlers = {
  // 基本CRUD操作

  /** 描画アノテーション作成（置き場所が無ければ main が用意する） */
  "drawing:create": async (
    target: AnnotationTarget,
    annotation: DrawingAnnotation
  ) => {
    const result = await drawingService.createDrawingAnnotation(
      target,
      annotation
    )
    return result
  },

  /** 行き先（答案＋設問＋採点者）に紐づく描画アノテーション取得 */
  "drawing:getByTarget": async (
    target: AnnotationTarget,
    type?: DrawingType
  ) => {
    const result = await drawingService.getDrawingAnnotationsByTarget(
      target,
      type
    )
    return result
  },

  /** 特定の受験者の全描画アノテーション取得（透明度制御用） */
  "drawing:getByExamStudent": async (
    examStudentId: string,
    type?: DrawingType,
    userId?: string
  ) => {
    const result = await drawingService.getDrawingAnnotationsByExamStudent(
      examStudentId,
      type,
      userId
    )
    return result
  },

  /** CropRegion（設問）に紐づく全学生の描画アノテーション取得（Grid表示用） */
  "drawing:getByCropRegion": async (cropRegionId: string, userId?: string) => {
    const result = await drawingService.getDrawingAnnotationsByCropRegion(
      cropRegionId,
      userId
    )
    return result
  },

  /** 描画アノテーション更新 */
  "drawing:update": async (annotation: DrawingAnnotation) => {
    const result = await drawingService.updateDrawingAnnotation(annotation)
    return result
  },

  /** 描画アノテーション削除 */
  "drawing:delete": async (id: string) => {
    await drawingService.deleteDrawingAnnotation(id)
  },

  /** 行き先（答案＋設問＋採点者）に紐づく描画アノテーション一括削除 */
  "drawing:deleteByTarget": async (
    target: AnnotationTarget,
    type?: DrawingType
  ) => {
    await drawingService.deleteDrawingAnnotationsByTarget(target, type)
  },

  // バッチ操作

  /** 描画アノテーション一括作成（行き先ごとに置き場所を用意する） */
  "drawing:batchCreate": async (
    writes: Array<{ target: AnnotationTarget; annotation: DrawingAnnotation }>
  ) => {
    const result = await drawingService.batchCreateDrawingAnnotations(writes)
    return result
  },

  // ユーティリティ操作

  /** アノテーションお気に入り切替 */
  "drawing:toggleFavorite": async (id: string, isFavorite: boolean) => {
    const result = await drawingService.toggleAnnotationFavorite(id, isFavorite)
    return result
  },

  /** ブラウズ用アノテーション取得 */
  "drawing:getForBrowse": async (examId: string) => {
    const result = await drawingService.getAnnotationsForBrowse(examId)
    return result
  },
} satisfies HandlerMap
