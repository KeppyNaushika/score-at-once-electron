/**
 * 描画アノテーション関連API
 */
export interface DrawingAPI {
  drawing: {
    create: (
      data: import("../drawingAnnotation.types").DrawingCreateData
    ) => Promise<{
      success: boolean
      data?: import("../drawingAnnotation.types").DrawingAnnotation
      error?: string
    }>
    getByQuestionScore: (
      questionScoreId: string,
      type?: import("../drawingAnnotation.types").DrawingType,
      userId?: string
    ) => Promise<{
      success: boolean
      data?: import("../drawingAnnotation.types").DrawingAnnotation[]
      error?: string
    }>
    getByExamStudent: (
      examStudentId: string,
      type?: import("../drawingAnnotation.types").DrawingType,
      userId?: string
    ) => Promise<{
      success: boolean
      data?: import("../drawingAnnotation.types").DrawingAnnotation[]
      error?: string
    }>
    getByExam: (
      examId: string,
      type?: import("../drawingAnnotation.types").DrawingType,
      userId?: string
    ) => Promise<{
      success: boolean
      data?: import("../drawingAnnotation.types").DrawingAnnotation[]
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
      data?: import("../drawingAnnotation.types").AnnotationWithContext[]
      error?: string
    }>
    update: (
      id: string,
      data: import("../drawingAnnotation.types").DrawingUpdateData
    ) => Promise<{
      success: boolean
      data?: import("../drawingAnnotation.types").DrawingAnnotation
      error?: string
    }>
    delete: (id: string) => Promise<{
      success: boolean
      error?: string
    }>
    deleteByQuestionScore: (
      questionScoreId: string,
      type?: import("../drawingAnnotation.types").DrawingType
    ) => Promise<{
      success: boolean
      error?: string
    }>
    batchCreate: (
      annotations: import("../drawingAnnotation.types").DrawingCreateData[]
    ) => Promise<{
      success: boolean
      data?: import("../drawingAnnotation.types").DrawingAnnotation[]
      error?: string
    }>
    batchUpdate: (
      updates: Array<{
        id: string
        data: import("../drawingAnnotation.types").DrawingUpdateData
      }>
    ) => Promise<{
      success: boolean
      data?: import("../drawingAnnotation.types").DrawingAnnotation[]
      error?: string
    }>
    getStats: (questionScoreId: string) => Promise<{
      success: boolean
      data?: import("../drawingAnnotation.types").DrawingAnnotationStats
      error?: string
    }>
    getById: (id: string) => Promise<{
      success: boolean
      data?: import("../drawingAnnotation.types").DrawingAnnotation | null
      error?: string
    }>
    toggleFavorite: (
      id: string,
      isFavorite: boolean
    ) => Promise<{
      success: boolean
      data?: import("../drawingAnnotation.types").DrawingAnnotation
      error?: string
    }>
    getForBrowse: (examId: string) => Promise<{
      success: boolean
      data?: import("../drawingAnnotation.types").AnnotationWithContext[]
      error?: string
    }>
  }
}
