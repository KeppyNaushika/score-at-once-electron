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
  /** ExamClassroom ID: 旧ID -> 新ID (v1.1.0+) */
  examClassroom: Record<string, string>
  /** Student ID: 旧ID -> 新ID */
  student: Record<string, string>
  /** Classroom ID: 旧ID -> 新ID */
  classroom: Record<string, string>
  /** StudentClassroomMembership ID: 旧ID -> 新ID */
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
  /** ReturnSnapshot ID: 旧ID -> 新ID (v1.14.0+) */
  returnSnapshot: Record<string, string>
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
  /** CropRegionOmrDigitBox ID: 旧ID -> 新ID (v1.11.0+) */
  cropRegionOmrDigitBox: Record<string, string>
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
    examClassroom: {},
    student: {},
    classroom: {},
    membership: {},
    user: {},
    subtotalGroup: {},
    subtotal: {},
    cropSubtotal: {},
    questionScore: {},
    scoreDecision: {},
    returnSnapshot: {},
    drawingAnnotation: {},
    examMarkingFormat: {},
    examExportSettings: {},
    cropRegionMarkingOverride: {},
    tag: {},
    tagSubtotalGroup: {},
    examTag: {},
    cropRegionOmrConfig: {},
    cropRegionOmrChoiceOption: {},
    cropRegionOmrDigitBox: {},
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
  for (const masterImage of data.examData.masterImages || []) {
    mappings.masterImage[masterImage.id] = randomUUID()
  }

  // v1.2.0+: StudentAnswerImage
  for (const studentAnswerImage of data.examData.studentAnswerImages || []) {
    mappings.studentAnswerImage[studentAnswerImage.id] = randomUUID()
  }

  // v1.1.0以前: PageImage（後方互換性）
  for (const pageImage of data.examData.pageImages) {
    mappings.pageImage[pageImage.id] = randomUUID()
  }

  // ExamStudent
  for (const examStudent of data.examData.examStudents) {
    mappings.examStudent[examStudent.id] = randomUUID()
  }

  // UserExam
  for (const userExam of data.examData.userExams) {
    mappings.userExam[userExam.id] = randomUUID()
  }

  // ExamSubtotalGroup
  for (const examSubtotalGroup of data.examData.examSubtotalGroups) {
    mappings.examSubtotalGroup[examSubtotalGroup.id] = randomUUID()
  }

  // ExamClassroom (v1.1.0+)
  for (const examClassroom of data.examData.examClassrooms || []) {
    mappings.examClassroom[examClassroom.id] = randomUUID()
  }

  // 生徒
  for (const student of data.studentsData.students) {
    mappings.student[student.id] = randomUUID()
  }

  // 学級
  for (const classroom of data.classesData.classrooms) {
    mappings.classroom[classroom.id] = randomUUID()
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
  for (const subtotalGroup of data.subtotalsData.subtotalGroups) {
    mappings.subtotalGroup[subtotalGroup.id] = randomUUID()
  }

  // 小計
  for (const subtotal of data.subtotalsData.subtotals) {
    mappings.subtotal[subtotal.id] = randomUUID()
  }

  // CropSubtotal
  for (const cropSubtotal of data.subtotalsData.cropSubtotals) {
    mappings.cropSubtotal[cropSubtotal.id] = randomUUID()
  }

  // QuestionScore
  for (const questionScore of data.scoresData.questionScores) {
    mappings.questionScore[questionScore.id] = randomUUID()
  }

  // v1.13.0+: ScoreDecision
  for (const scoreDecision of data.scoresData.scoreDecisions || []) {
    mappings.scoreDecision[scoreDecision.id] = randomUUID()
  }

  // v1.14.0+: ReturnSnapshot
  for (const returnSnapshot of data.scoresData.returnSnapshots || []) {
    mappings.returnSnapshot[returnSnapshot.id] = randomUUID()
  }

  // DrawingAnnotation
  for (const drawingAnnotation of data.scoresData.drawingAnnotations) {
    mappings.drawingAnnotation[drawingAnnotation.id] = randomUUID()
  }

  // v1.4.0+: ExamMarkingFormat
  for (const examMarkingFormat of data.examData.examMarkingFormats || []) {
    mappings.examMarkingFormat[examMarkingFormat.id] = randomUUID()
  }

  // v1.4.0+: ExamExportSettings
  if (data.examData.examExportSettings) {
    mappings.examExportSettings[data.examData.examExportSettings.id] =
      randomUUID()
  }

  // v1.4.0+: CropRegionMarkingOverride
  for (const cropRegionMarkingOverride of data.examData
    .cropRegionMarkingOverrides || []) {
    mappings.cropRegionMarkingOverride[cropRegionMarkingOverride.id] =
      randomUUID()
  }

  // v1.7.0+: CropRegionOmrConfig
  for (const omrConfig of data.examData.omrConfigs || []) {
    mappings.cropRegionOmrConfig[omrConfig.id] = randomUUID()
  }

  // v1.7.0+: CropRegionOmrChoiceOption
  for (const omrChoiceOption of data.examData.omrChoiceOptions || []) {
    mappings.cropRegionOmrChoiceOption[omrChoiceOption.id] = randomUUID()
  }

  // v1.11.0+: CropRegionOmrDigitBox
  for (const omrDigitBox of data.examData.omrDigitBoxes || []) {
    mappings.cropRegionOmrDigitBox[omrDigitBox.id] = randomUUID()
  }

  // v1.11.0+: CompoundAnswer
  for (const compoundAnswer of data.examData.compoundAnswers || []) {
    mappings.compoundAnswer[compoundAnswer.id] = randomUUID()
  }

  // v1.11.0+: CompoundAnswerMember
  for (const compoundAnswerMember of data.examData.compoundAnswerMembers ||
    []) {
    mappings.compoundAnswerMember[compoundAnswerMember.id] = randomUUID()
  }

  // v1.11.0+: CompoundAnswerScore
  for (const compoundAnswerScore of data.examData.compoundAnswerScores || []) {
    mappings.compoundAnswerScore[compoundAnswerScore.id] = randomUUID()
  }

  // v1.10.0+: Tag (旧Subject)
  const tagsData = data.tagsData
  if (tagsData) {
    for (const tag of tagsData.tags) {
      mappings.tag[tag.id] = randomUUID()
    }

    // TagSubtotalGroup (旧SubjectSubtotalGroup)
    for (const tagSubtotalGroup of tagsData.tagSubtotalGroups) {
      mappings.tagSubtotalGroup[tagSubtotalGroup.id] = randomUUID()
    }

    // ExamTag
    for (const examTag of tagsData.examTags) {
      mappings.examTag[examTag.id] = randomUUID()
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
