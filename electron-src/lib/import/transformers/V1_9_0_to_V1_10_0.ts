/**
 * v1.9.0 → v1.10.0 変換器
 *
 * 主な変更点:
 * - Subject → Tag リネーム
 * - SubjectSubtotalGroup → TagSubtotalGroup リネーム (subjectId → tagId)
 * - ExamTag 追加（多対多）
 * - Exam.subject フィールド削除
 *
 * v1.9.0形式のアーカイブには subjectsData が存在するため、
 * それを tagsData に変換する
 */

import type {
  ExamArchiveData,
  ExamArchiveVersion,
  ExamTransformResult,
  ExamVersionTransformer,
} from "../../../../src/types/examArchive.types"

export class V1_9_0_to_V1_10_0_Transformer implements ExamVersionTransformer {
  readonly fromVersion: ExamArchiveVersion = "1.9.0"
  readonly toVersion: ExamArchiveVersion = "1.10.0"

  transform(data: ExamArchiveData): ExamTransformResult {
    const warnings: string[] = []
    warnings.push(
      `アーカイブはv0.9.x形式(archive v${this.fromVersion})で作成されています。` +
        `Subject→Tagリネーム、ExamTag追加が適用されます。`
    )

    // Convert old subjectsData to new tagsData
    const oldSubjectsData = data.subjectsData ?? {
      subjects: [],
      subjectSubtotalGroups: [],
    }

    // 既に tagsData を持つデータ（現行形式）には無変更で冪等。
    // subjectsData からの再構築で実データを上書きしない
    const tagsData = data.tagsData ?? {
      tags: oldSubjectsData.subjects ?? [],
      tagSubtotalGroups: (oldSubjectsData.subjectSubtotalGroups ?? []).map(
        (ssg: {
          id: string
          subjectId: string
          subtotalGroupId: string
          createdAt: string
          updatedAt: string
        }) => ({
          id: ssg.id,
          tagId: ssg.subjectId,
          subtotalGroupId: ssg.subtotalGroupId,
          createdAt: ssg.createdAt,
          updatedAt: ssg.updatedAt,
        })
      ),
      examTags: [],
    }

    return {
      data: {
        ...data,
        manifest: { ...data.manifest, version: this.toVersion },
        tagsData,
        subjectsData: undefined, // remove old field
      },
      warnings,
    }
  }
}
