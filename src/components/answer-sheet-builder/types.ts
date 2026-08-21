import type {
  AsbBranchQuestionAttributes,
  AsbCellParent,
  AsbCharGuideAttributes,
  AsbDefinitionUpdate,
  AsbHeaderFieldAttributes,
  AsbImageElementAttributes,
  AsbMajorQuestionAttributes,
  AsbManuscriptPaperSettings,
  AsbSubQuestionUpdate,
  AsbTextElementAttributes,
  CellImageElement,
  HeaderFieldDefinition,
  LabelCategory,
  ManuscriptCharGuide,
} from "@/types/answerSheetDefinition.types"
import type { OMRCellConfig } from "@/types/omr.types"

/**
 * 解答用紙の編集操作ひとそろい。
 *
 * フォームは 大問 → 小問 → 枝問 → セルの中身 と深く入れ子になり、どの層からでも
 * どの実体でも触れる（枝問のフォームから OMR 設定を書く、など）。**1つずつ props で
 * 配ると同じ関数が4層を素通りするだけ**なので、まとめて1つで渡す。
 *
 * すべて**対象を id で指す**。並べ替えだけは新しい並びが画面にしか無いので id の並びを渡す。
 * 実体を新しく作るもの（画像要素・文字位置マーカー）は、作れる場所が画面側にしかないため
 * 実体そのものを受け取る。
 */
export interface AsbEditorActions {
  updateDefinition: (data: AsbDefinitionUpdate) => void
  applyLabelPreset: (category: LabelCategory, preset: string) => void

  addHeaderField: (defaults?: Partial<HeaderFieldDefinition>) => void
  updateHeaderField: (
    headerFieldId: string,
    data: Partial<AsbHeaderFieldAttributes>
  ) => void
  deleteHeaderField: (headerFieldId: string) => void
  reorderHeaderFields: (orderedIds: string[]) => void

  addMajorQuestion: () => void
  updateMajorQuestion: (
    majorQuestionId: string,
    data: Partial<AsbMajorQuestionAttributes>
  ) => void
  deleteMajorQuestion: (majorQuestionId: string) => void
  reorderMajorQuestions: (orderedIds: string[]) => void

  addSubQuestion: (majorQuestionId: string) => void
  updateSubQuestion: (subQuestionId: string, data: AsbSubQuestionUpdate) => void
  deleteSubQuestion: (subQuestionId: string) => void
  reorderSubQuestions: (majorQuestionId: string, orderedIds: string[]) => void

  addBranchQuestion: (subQuestionId: string) => void
  updateBranchQuestion: (
    branchQuestionId: string,
    data: Partial<AsbBranchQuestionAttributes>
  ) => void
  deleteBranchQuestion: (branchQuestionId: string) => void
  reorderBranchQuestions: (subQuestionId: string, orderedIds: string[]) => void

  addTextElement: (parent: AsbCellParent) => void
  updateTextElement: (
    textElementId: string,
    data: Partial<AsbTextElementAttributes>
  ) => void
  deleteTextElement: (textElementId: string) => void

  addImageElement: (
    parent: AsbCellParent,
    imageElement: CellImageElement
  ) => void
  updateImageElement: (
    imageElementId: string,
    data: Partial<AsbImageElementAttributes>
  ) => void
  deleteImageElement: (imageElementId: string) => void

  upsertOmrConfig: (parent: AsbCellParent, config: OMRCellConfig) => void
  deleteOmrConfig: (parent: AsbCellParent) => void

  /** 原稿用紙を使うかどうか。オンにするとき、行が無ければ作る */
  setManuscriptPaperEnabled: (parent: AsbCellParent, enabled: boolean) => void
  /** 原稿用紙の設定（列数・行数・ガイド）。行が在るときだけ */
  updateManuscriptPaper: (
    manuscriptPaperId: string,
    data: Partial<AsbManuscriptPaperSettings>
  ) => void

  addCharGuide: (
    manuscriptPaperId: string,
    charGuide: ManuscriptCharGuide
  ) => void
  updateCharGuide: (
    charGuideId: string,
    data: Partial<AsbCharGuideAttributes>
  ) => void
  deleteCharGuide: (charGuideId: string) => void
}
