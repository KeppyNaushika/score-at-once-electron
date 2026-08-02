/**
 * 描画アノテーション関連API
 */

import type {
  AnnotationWithAuthor,
  AnnotationWithContext,
  DrawingCreateData,
  DrawingType,
  DrawingUpdateData,
} from "../drawingAnnotation.types"

export interface DrawingAPI {
  drawing: {
    create: (data: DrawingCreateData) => Promise<{
      success: boolean
      data?: AnnotationWithContext
      error?: string
    }>
    // 採点者引数は無い。QuestionScore は「生徒×設問×採点者」で1行なので、
    // 同じ questionScoreId の注釈は全部同じ採点者のものである
    getByQuestionScore: (
      questionScoreId: string,
      type?: DrawingType
    ) => Promise<{
      success: boolean
      data?: AnnotationWithAuthor[]
      error?: string
    }>
    getByExamStudent: (
      examStudentId: string,
      type?: DrawingType,
      userId?: string
    ) => Promise<{
      success: boolean
      data?: AnnotationWithContext[]
      error?: string
    }>
    // main 側は questionScore（examStudentId / cropRegion）を include して返すので、
    // 契約もそれを表す型にする。DrawingAnnotation[] にすると受け手が `as` で
    // 補うことになり、main の select から列が消えても型検査が効かなくなる。
    getByCropRegion: (
      cropRegionId: string,
      userId?: string
    ) => Promise<{
      success: boolean
      data?: AnnotationWithContext[]
      error?: string
    }>
    update: (
      id: string,
      data: DrawingUpdateData
    ) => Promise<{
      success: boolean
      data?: AnnotationWithContext
      error?: string
    }>
    delete: (id: string) => Promise<{
      success: boolean
      error?: string
    }>
    deleteByQuestionScore: (
      questionScoreId: string,
      type?: DrawingType
    ) => Promise<{
      success: boolean
      error?: string
    }>
    batchCreate: (annotations: DrawingCreateData[]) => Promise<{
      success: boolean
      data?: AnnotationWithContext[]
      error?: string
    }>
    toggleFavorite: (
      id: string,
      isFavorite: boolean
    ) => Promise<{
      success: boolean
      data?: AnnotationWithContext
      error?: string
    }>
    getForBrowse: (examId: string) => Promise<{
      success: boolean
      data?: AnnotationWithContext[]
      error?: string
    }>
  }
}
