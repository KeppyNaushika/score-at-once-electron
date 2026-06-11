/**
 * ID再マッピングモジュール
 *
 * インポート時に全てのUUIDを新規生成し、参照関係を維持
 */

import { randomUUID } from "crypto"

import type { ExtractedArchiveData } from "./archiveExtractor"

/**
 * IDマッピング結果
 */
export interface IdMappings {
  /** 試験ID: 旧ID -> 新ID */
  exam: Record<string, string>
  /** ExamPage ID: 旧ID -> 新ID */
  examPage: Record<string, string>
  /** CropRegion ID: 旧ID -> 新ID */
  cropRegion: Record<string, string>
  /** MasterImage ID: 旧ID -> 新ID */
  masterImage: Record<string, string>
  /** StudentAnswerImage ID: 旧ID -> 新ID */
  studentAnswerImage: Record<string, string>
  /** @deprecated v1.2.0以降は masterImage/studentAnswerImage を使用 */
  pageImage: Record<string, string>
  /** ExamStudent ID: 旧ID -> 新ID */
  examStudent: Record<string, string>
  /** UserExam ID: 旧ID -> 新ID */
  userExam: Record<string, string>
  /** ExamSubtotalGroup ID: 旧ID -> 新ID */
  examSubtotalGroup: Record<string, string>
  /** ExamClass ID: 旧ID -> 新ID (v1.1.0+) */
  examClass: Record<string, string>
  /** Student ID: 旧ID -> 新ID */
  student: Record<string, string>
  /** Class ID: 旧ID -> 新ID */
  class: Record<string, string>
  /** StudentClassMembership ID: 旧ID -> 新ID */
  membership: Record<string, string>
  /** User ID: 旧ID -> 新ID */
  user: Record<string, string>
  /** SubtotalGroup ID: 旧ID -> 新ID */
  subtotalGroup: Record<string, string>
  /** Subtotal ID: 旧ID -> 新ID */
  subtotal: Record<string, string>
  /** CropSubtotal ID: 旧ID -> 新ID */
  cropSubtotal: Record<string, string>
  /** QuestionScore ID: 旧ID -> 新ID */
  questionScore: Record<string, string>
  /** ScoreDecision ID: 旧ID -> 新ID (v1.13.0+) */
  scoreDecision: Record<string, string>
  /** DrawingAnnotation ID: 旧ID -> 新ID */
  drawingAnnotation: Record<string, string>
  /** ExamMarkingFormat ID: 旧ID -> 新ID (v1.4.0+) */
  examMarkingFormat: Record<string, string>
  /** ExamExportSettings ID: 旧ID -> 新ID (v1.4.0+) */
  examExportSettings: Record<string, string>
  /** CropRegionMarkingOverride ID: 旧ID -> 新ID (v1.4.0+) */
  cropRegionMarkingOverride: Record<string, string>
  /** Tag ID: 旧ID -> 新ID (v1.10.0+, 旧Subject) */
  tag: Record<string, string>
  /** TagSubtotalGroup ID: 旧ID -> 新ID (v1.10.0+, 旧SubjectSubtotalGroup) */
  tagSubtotalGroup: Record<string, string>
  /** ExamTag ID: 旧ID -> 新ID (v1.10.0+) */
  examTag: Record<string, string>
  /** CropRegionOmrConfig ID: 旧ID -> 新ID (v1.7.0+) */
  cropRegionOmrConfig: Record<string, string>
  /** CropRegionOmrChoiceOption ID: 旧ID -> 新ID (v1.7.0+) */
  cropRegionOmrChoiceOption: Record<string, string>
  /** CompoundAnswer ID: 旧ID -> 新ID (v1.11.0+) */
  compoundAnswer: Record<string, string>
  /** CompoundAnswerMember ID: 旧ID -> 新ID (v1.11.0+) */
  compoundAnswerMember: Record<string, string>
  /** CompoundAnswerScore ID: 旧ID -> 新ID (v1.11.0+) */
  compoundAnswerScore: Record<string, string>
}

/**
 * 新規作成モード用のIDマッピングを生成
 *
 * 全てのIDを新規UUIDに置き換える
 *
 * @param data - 展開されたアーカイブデータ
 * @returns IDマッピング
 */
export function generateNewIdMappings(data: ExtractedArchiveData): IdMappings {
  const mappings: IdMappings = {
    exam: {},
    examPage: {},
    cropRegion: {},
    masterImage: {},
    studentAnswerImage: {},
    pageImage: {},
    examStudent: {},
    userExam: {},
    examSubtotalGroup: {},
    examClass: {},
    student: {},
    class: {},
    membership: {},
    user: {},
    subtotalGroup: {},
    subtotal: {},
    cropSubtotal: {},
    questionScore: {},
    scoreDecision: {},
    drawingAnnotation: {},
    examMarkingFormat: {},
    examExportSettings: {},
    cropRegionMarkingOverride: {},
    tag: {},
    tagSubtotalGroup: {},
    examTag: {},
    cropRegionOmrConfig: {},
    cropRegionOmrChoiceOption: {},
    compoundAnswer: {},
    compoundAnswerMember: {},
    compoundAnswerScore: {},
  }

  // 試験
  mappings.exam[data.examData.exam.id] = randomUUID()

  // 試験ページ
  for (const page of data.examData.examPages) {
    mappings.examPage[page.id] = randomUUID()
  }

  // CropRegion
  for (const region of data.examData.cropRegions) {
    mappings.cropRegion[region.id] = randomUUID()
  }

  // v1.2.0+: MasterImage
  for (const img of data.examData.masterImages || []) {
    mappings.masterImage[img.id] = randomUUID()
  }

  // v1.2.0+: StudentAnswerImage
  for (const img of data.examData.studentAnswerImages || []) {
    mappings.studentAnswerImage[img.id] = randomUUID()
  }

  // v1.1.0以前: PageImage（後方互換性）
  for (const img of data.examData.pageImages) {
    mappings.pageImage[img.id] = randomUUID()
  }

  // ExamStudent
  for (const ps of data.examData.examStudents) {
    mappings.examStudent[ps.id] = randomUUID()
  }

  // UserExam
  for (const up of data.examData.userExams) {
    mappings.userExam[up.id] = randomUUID()
  }

  // ExamSubtotalGroup
  for (const psg of data.examData.examSubtotalGroups) {
    mappings.examSubtotalGroup[psg.id] = randomUUID()
  }

  // ExamClass (v1.1.0+)
  for (const pc of data.examData.examClasses || []) {
    mappings.examClass[pc.id] = randomUUID()
  }

  // 生徒
  for (const student of data.studentsData.students) {
    mappings.student[student.id] = randomUUID()
  }

  // 学級
  for (const cls of data.classesData.classes) {
    mappings.class[cls.id] = randomUUID()
  }

  // 学級所属
  for (const membership of data.classesData.memberships) {
    mappings.membership[membership.id] = randomUUID()
  }

  // ユーザー
  for (const user of data.usersData.users) {
    mappings.user[user.id] = randomUUID()
  }

  // 小計グループ
  for (const sg of data.subtotalsData.subtotalGroups) {
    mappings.subtotalGroup[sg.id] = randomUUID()
  }

  // 小計
  for (const s of data.subtotalsData.subtotals) {
    mappings.subtotal[s.id] = randomUUID()
  }

  // CropSubtotal
  for (const cs of data.subtotalsData.cropSubtotals) {
    mappings.cropSubtotal[cs.id] = randomUUID()
  }

  // QuestionScore
  for (const qs of data.scoresData.questionScores) {
    mappings.questionScore[qs.id] = randomUUID()
  }

  // v1.13.0+: ScoreDecision
  for (const sd of data.scoresData.scoreDecisions || []) {
    mappings.scoreDecision[sd.id] = randomUUID()
  }

  // DrawingAnnotation
  for (const da of data.scoresData.drawingAnnotations) {
    mappings.drawingAnnotation[da.id] = randomUUID()
  }

  // v1.4.0+: ExamMarkingFormat
  for (const pmf of data.examData.examMarkingFormats || []) {
    mappings.examMarkingFormat[pmf.id] = randomUUID()
  }

  // v1.4.0+: ExamExportSettings
  if (data.examData.examExportSettings) {
    mappings.examExportSettings[data.examData.examExportSettings.id] =
      randomUUID()
  }

  // v1.4.0+: CropRegionMarkingOverride
  for (const crmo of data.examData.cropRegionMarkingOverrides || []) {
    mappings.cropRegionMarkingOverride[crmo.id] = randomUUID()
  }

  // v1.7.0+: CropRegionOmrConfig
  for (const cfg of data.examData.omrConfigs || []) {
    mappings.cropRegionOmrConfig[cfg.id] = randomUUID()
  }

  // v1.7.0+: CropRegionOmrChoiceOption
  for (const opt of data.examData.omrChoiceOptions || []) {
    mappings.cropRegionOmrChoiceOption[opt.id] = randomUUID()
  }

  // v1.11.0+: CompoundAnswer
  for (const ca of data.examData.compoundAnswers || []) {
    mappings.compoundAnswer[ca.id] = randomUUID()
  }

  // v1.11.0+: CompoundAnswerMember
  for (const cam of data.examData.compoundAnswerMembers || []) {
    mappings.compoundAnswerMember[cam.id] = randomUUID()
  }

  // v1.11.0+: CompoundAnswerScore
  for (const cas of data.examData.compoundAnswerScores || []) {
    mappings.compoundAnswerScore[cas.id] = randomUUID()
  }

  // v1.10.0+: Tag (旧Subject)
  const tagsData = data.tagsData
  if (tagsData) {
    for (const tag of tagsData.tags) {
      mappings.tag[tag.id] = randomUUID()
    }

    // TagSubtotalGroup (旧SubjectSubtotalGroup)
    for (const tsg of tagsData.tagSubtotalGroups) {
      mappings.tagSubtotalGroup[tsg.id] = randomUUID()
    }

    // ExamTag
    for (const et of tagsData.examTags) {
      mappings.examTag[et.id] = randomUUID()
    }
  }

  return mappings
}

/**
 * IDを再マッピングする（nullable対応）
 *
 * @param oldId - 旧ID（nullの場合もある）
 * @param mapping - IDマッピング
 * @returns 新ID（oldIdがnullの場合はnull）
 */
export function remapId(
  oldId: string | null | undefined,
  mapping: Record<string, string>
): string | null {
  if (!oldId) return null
  return mapping[oldId] ?? null
}

/**
 * IDを再マッピングする（必須）
 *
 * @param oldId - 旧ID
 * @param mapping - IDマッピング
 * @returns 新ID
 * @throws マッピングが見つからない場合
 */
export function remapIdRequired(
  oldId: string,
  mapping: Record<string, string>
): string {
  const newId = mapping[oldId]
  if (!newId) {
    throw new Error(`ID mapping not found for: ${oldId}`)
  }
  return newId
}
