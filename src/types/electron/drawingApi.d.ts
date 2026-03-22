/**
 * 描画アノテーション関連API
 */
export interface DrawingAPI {
  drawing: {
    create: (
      data: import("../drawing-annotation.types").DrawingCreateData
    ) => Promise<{
      success: boolean
      data?: import("../drawing-annotation.types").DrawingAnnotation
      error?: string
    }>
    getByQuestionScore: (
      questionScoreId: string,
      type?: import("../drawing-annotation.types").DrawingType,
      userId?: string
    ) => Promise<{
      success: boolean
      data?: import("../drawing-annotation.types").DrawingAnnotation[]
      error?: string
    }>
    getByStudent: (
      studentId: string,
      examId: string,
      type?: import("../drawing-annotation.types").DrawingType,
      userId?: string
    ) => Promise<{
      success: boolean
      data?: import("../drawing-annotation.types").DrawingAnnotation[]
      error?: string
    }>
    getByExam: (
      examId: string,
      type?: import("../drawing-annotation.types").DrawingType,
      userId?: string
    ) => Promise<{
      success: boolean
      data?: import("../drawing-annotation.types").DrawingAnnotation[]
      error?: string
    }>
    getByCropRegion: (
      cropRegionId: string,
      userId?: string
    ) => Promise<{
      success: boolean
      data?: import("../drawing-annotation.types").DrawingAnnotation[]
      error?: string
    }>
    update: (
      id: string,
      data: import("../drawing-annotation.types").DrawingUpdateData
    ) => Promise<{
      success: boolean
      data?: import("../drawing-annotation.types").DrawingAnnotation
      error?: string
    }>
    delete: (id: string) => Promise<{
      success: boolean
      error?: string
    }>
    deleteByQuestionScore: (
      questionScoreId: string,
      type?: import("../drawing-annotation.types").DrawingType
    ) => Promise<{
      success: boolean
      error?: string
    }>
    batchCreate: (
      annotations: import("../drawing-annotation.types").DrawingCreateData[]
    ) => Promise<{
      success: boolean
      data?: import("../drawing-annotation.types").DrawingAnnotation[]
      error?: string
    }>
    batchUpdate: (
      updates: Array<{
        id: string
        data: import("../drawing-annotation.types").DrawingUpdateData
      }>
    ) => Promise<{
      success: boolean
      data?: import("../drawing-annotation.types").DrawingAnnotation[]
      error?: string
    }>
    getStats: (questionScoreId: string) => Promise<{
      success: boolean
      data?: import("../drawing-annotation.types").DrawingAnnotationStats
      error?: string
    }>
    getById: (id: string) => Promise<{
      success: boolean
      data?: import("../drawing-annotation.types").DrawingAnnotation | null
      error?: string
    }>
    toggleFavorite: (
      id: string,
      isFavorite: boolean
    ) => Promise<{
      success: boolean
      data?: import("../drawing-annotation.types").DrawingAnnotation
      error?: string
    }>
    getForBrowse: (examId: string) => Promise<{
      success: boolean
      data?: import("../drawing-annotation.types").AnnotationWithContext[]
      error?: string
    }>
  }
}
