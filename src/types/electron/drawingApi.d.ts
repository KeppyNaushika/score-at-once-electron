/**
 * 描画アノテーション関連API
 */

import type {
  AnnotationWithContext,
  DrawingAnnotation,
  DrawingType,
} from "../drawingAnnotation.types"

export interface DrawingAPI {
  drawing: {
    // 作成・更新はどちらも行そのものを渡す。DB に保存されている形をそのまま
    // やり取りするので、変換用の入力型は無い
    create: (annotation: DrawingAnnotation) => Promise<AnnotationWithContext>
    // 採点者引数は無い。QuestionScore は「生徒×設問×採点者」で1行なので、
    // 同じ questionScoreId の注釈は全部同じ採点者のものである。
    // 返すのは関係を同梱しない行。Canvas はこれを編集して書き戻す
    getByQuestionScore: (
      questionScoreId: string,
      type?: DrawingType
    ) => Promise<DrawingAnnotation[]>
    getByExamStudent: (
      examStudentId: string,
      type?: DrawingType,
      userId?: string
    ) => Promise<AnnotationWithContext[]>
    // main 側は questionScore（examStudentId / cropRegion）を include して返すので、
    // 契約もそれを表す型にする。DrawingAnnotation[] にすると受け手が `as` で
    // 補うことになり、main の select から列が消えても型検査が効かなくなる。
    getByCropRegion: (
      cropRegionId: string,
      userId?: string
    ) => Promise<AnnotationWithContext[]>
    update: (annotation: DrawingAnnotation) => Promise<AnnotationWithContext>
    delete: (id: string) => Promise<void>
    deleteByQuestionScore: (
      questionScoreId: string,
      type?: DrawingType
    ) => Promise<void>
    batchCreate: (
      annotations: DrawingAnnotation[]
    ) => Promise<AnnotationWithContext[]>
    toggleFavorite: (
      id: string,
      isFavorite: boolean
    ) => Promise<AnnotationWithContext>
    getForBrowse: (examId: string) => Promise<AnnotationWithContext[]>
  }
}
