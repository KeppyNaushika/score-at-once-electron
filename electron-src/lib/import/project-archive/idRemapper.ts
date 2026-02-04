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
  /** プロジェクトID: 旧ID -> 新ID */
  project: Record<string, string>
  /** ProjectPage ID: 旧ID -> 新ID */
  projectPage: Record<string, string>
  /** CropRegion ID: 旧ID -> 新ID */
  cropRegion: Record<string, string>
  /** MasterImage ID: 旧ID -> 新ID */
  masterImage: Record<string, string>
  /** StudentAnswerImage ID: 旧ID -> 新ID */
  studentAnswerImage: Record<string, string>
  /** @deprecated v1.2.0以降は masterImage/studentAnswerImage を使用 */
  pageImage: Record<string, string>
  /** ProjectStudent ID: 旧ID -> 新ID */
  projectStudent: Record<string, string>
  /** UserProject ID: 旧ID -> 新ID */
  userProject: Record<string, string>
  /** ProjectSubtotalGroup ID: 旧ID -> 新ID */
  projectSubtotalGroup: Record<string, string>
  /** ProjectClass ID: 旧ID -> 新ID (v1.1.0+) */
  projectClass: Record<string, string>
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
  /** DrawingAnnotation ID: 旧ID -> 新ID */
  drawingAnnotation: Record<string, string>
  /** ProjectMarkingFormat ID: 旧ID -> 新ID (v1.4.0+) */
  projectMarkingFormat: Record<string, string>
  /** ProjectExportSettings ID: 旧ID -> 新ID (v1.4.0+) */
  projectExportSettings: Record<string, string>
  /** CropRegionMarkingOverride ID: 旧ID -> 新ID (v1.4.0+) */
  cropRegionMarkingOverride: Record<string, string>
  /** Subject ID: 旧ID -> 新ID (v1.4.0+) */
  subject: Record<string, string>
  /** SubjectSubtotalGroup ID: 旧ID -> 新ID (v1.4.0+) */
  subjectSubtotalGroup: Record<string, string>
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
    project: {},
    projectPage: {},
    cropRegion: {},
    masterImage: {},
    studentAnswerImage: {},
    pageImage: {},
    projectStudent: {},
    userProject: {},
    projectSubtotalGroup: {},
    projectClass: {},
    student: {},
    class: {},
    membership: {},
    user: {},
    subtotalGroup: {},
    subtotal: {},
    cropSubtotal: {},
    questionScore: {},
    drawingAnnotation: {},
    projectMarkingFormat: {},
    projectExportSettings: {},
    cropRegionMarkingOverride: {},
    subject: {},
    subjectSubtotalGroup: {},
  }

  // プロジェクト
  mappings.project[data.projectData.project.id] = randomUUID()

  // プロジェクトページ
  for (const page of data.projectData.projectPages) {
    mappings.projectPage[page.id] = randomUUID()
  }

  // CropRegion
  for (const region of data.projectData.cropRegions) {
    mappings.cropRegion[region.id] = randomUUID()
  }

  // v1.2.0+: MasterImage
  for (const img of data.projectData.masterImages || []) {
    mappings.masterImage[img.id] = randomUUID()
  }

  // v1.2.0+: StudentAnswerImage
  for (const img of data.projectData.studentAnswerImages || []) {
    mappings.studentAnswerImage[img.id] = randomUUID()
  }

  // v1.1.0以前: PageImage（後方互換性）
  for (const img of data.projectData.pageImages) {
    mappings.pageImage[img.id] = randomUUID()
  }

  // ProjectStudent
  for (const ps of data.projectData.projectStudents) {
    mappings.projectStudent[ps.id] = randomUUID()
  }

  // UserProject
  for (const up of data.projectData.userProjects) {
    mappings.userProject[up.id] = randomUUID()
  }

  // ProjectSubtotalGroup
  for (const psg of data.projectData.projectSubtotalGroups) {
    mappings.projectSubtotalGroup[psg.id] = randomUUID()
  }

  // ProjectClass (v1.1.0+)
  for (const pc of data.projectData.projectClasses || []) {
    mappings.projectClass[pc.id] = randomUUID()
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

  // DrawingAnnotation
  for (const da of data.scoresData.drawingAnnotations) {
    mappings.drawingAnnotation[da.id] = randomUUID()
  }

  // v1.4.0+: ProjectMarkingFormat
  for (const pmf of data.projectData.projectMarkingFormats || []) {
    mappings.projectMarkingFormat[pmf.id] = randomUUID()
  }

  // v1.4.0+: ProjectExportSettings
  if (data.projectData.projectExportSettings) {
    mappings.projectExportSettings[data.projectData.projectExportSettings.id] =
      randomUUID()
  }

  // v1.4.0+: CropRegionMarkingOverride
  for (const crmo of data.projectData.cropRegionMarkingOverrides || []) {
    mappings.cropRegionMarkingOverride[crmo.id] = randomUUID()
  }

  // v1.4.0+: Subject
  const subjectsData = data.subjectsData
  if (subjectsData) {
    for (const subject of subjectsData.subjects) {
      mappings.subject[subject.id] = randomUUID()
    }

    // SubjectSubtotalGroup
    for (const ssg of subjectsData.subjectSubtotalGroups) {
      mappings.subjectSubtotalGroup[ssg.id] = randomUUID()
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
