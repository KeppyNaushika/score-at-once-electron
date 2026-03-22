/**
 * v1.4.0 → v1.5.0 変換器
 *
 * 主な変更点:
 * - Project → Exam リネーム（テーブル名、カラム名、JSON キー名）
 * - GradeProject → Grade リネーム
 * - manifest: projectId → examId, projectName → examName
 * - examData内の各フィールド名変更
 *
 * v1.4.0形式のアーカイブには旧名称(project系)のキーが使われているため、
 * 新名称(exam系)にリネームする
 */

import type {
  ArchiveData,
  ArchiveVersion,
  TransformResult,
  VersionTransformer,
} from "./types"

export class V1_4_0_to_V1_5_0_Transformer implements VersionTransformer {
  readonly fromVersion: ArchiveVersion = "1.4.0"
  readonly toVersion: ArchiveVersion = "1.5.0"

  transform(data: ArchiveData): TransformResult {
    const warnings: string[] = []

    warnings.push(
      `アーカイブはv1.4.0形式で作成されています。` +
        `Project→Exam, GradeProject→Grade のリネームが適用されます。`
    )

    // manifest内のキーをリネーム
    // 旧形式では projectId/projectName だが、既にbulk-renameで
    // examId/examNameに変換済みの場合もある。両方に対応する。
    const manifest = { ...data.manifest }
    const manifestAny = manifest as Record<string, unknown>

    // projectId → examId (旧アーカイブ対応)
    if ("projectId" in manifestAny && !manifest.examId) {
      const projectId = manifestAny.projectId
      if (typeof projectId === "string") manifest.examId = projectId
      delete manifestAny.projectId
    }
    // projectName → examName (旧アーカイブ対応)
    if ("projectName" in manifestAny && !manifest.examName) {
      const projectName = manifestAny.projectName
      if (typeof projectName === "string") manifest.examName = projectName
      delete manifestAny.projectName
    }

    manifest.version = this.toVersion

    // examData内のキーをリネーム
    const examData = { ...data.examData }
    const examDataAny = examData as Record<string, unknown>

    // project → exam のキーリネーム
    const keyRenames: [string, string][] = [
      ["projectPages", "examPages"],
      ["projectStudents", "examStudents"],
      ["userProjects", "userExams"],
      ["projectSubtotalGroups", "examSubtotalGroups"],
      ["projectClasses", "examClasses"],
      ["projectMarkingFormats", "examMarkingFormats"],
      ["projectExportSettings", "examExportSettings"],
    ]

    for (const [oldKey, newKey] of keyRenames) {
      if (oldKey in examDataAny && !(newKey in examDataAny)) {
        examDataAny[newKey] = examDataAny[oldKey]
        delete examDataAny[oldKey]
      }
    }

    // レコード配列内のフィールドをリネームするヘルパー
    function renameField<T>(
      arr: T[] | undefined,
      oldField: string,
      newField: string
    ): T[] | undefined {
      if (!Array.isArray(arr)) return arr
      return arr.map((item) => {
        const rec = item as Record<string, unknown>
        if (oldField in rec && !(newField in rec)) {
          const { [oldField]: value, ...rest } = rec
          return { ...rest, [newField]: value } as T
        }
        return item
      })
    }

    // 各レコード内のフィールドリネーム: projectId → examId
    examData.examPages = renameField(examData.examPages, "projectId", "examId")!
    examData.examStudents = renameField(
      examData.examStudents,
      "projectId",
      "examId"
    )!
    examData.userExams = renameField(examData.userExams, "projectId", "examId")!
    examData.examSubtotalGroups = renameField(
      examData.examSubtotalGroups,
      "projectId",
      "examId"
    )!
    examData.examClasses = renameField(
      examData.examClasses,
      "projectId",
      "examId"
    )!
    examData.examMarkingFormats = renameField(
      examData.examMarkingFormats,
      "projectId",
      "examId"
    )!

    // projectPageId → examPageId
    examData.cropRegions = renameField(
      examData.cropRegions,
      "projectPageId",
      "examPageId"
    )!
    examData.masterImages = renameField(
      examData.masterImages,
      "projectPageId",
      "examPageId"
    )!
    examData.studentAnswerImages = renameField(
      examData.studentAnswerImages,
      "projectPageId",
      "examPageId"
    )!

    // examExportSettings: projectId → examId
    if (examData.examExportSettings) {
      const ees = examData.examExportSettings as Record<string, unknown>
      if ("projectId" in ees && !("examId" in ees)) {
        const projectId = ees.projectId
        examData.examExportSettings = {
          ...examData.examExportSettings,
          ...(typeof projectId === "string" ? { examId: projectId } : {}),
        }
      }
    }

    return {
      data: {
        ...data,
        manifest,
        examData,
      },
      warnings,
    }
  }
}
