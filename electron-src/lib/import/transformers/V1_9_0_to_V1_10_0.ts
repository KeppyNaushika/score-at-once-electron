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
  ArchiveData,
  ArchiveVersion,
  TransformResult,
  VersionTransformer,
} from "./types"

export class V1_9_0_to_V1_10_0_Transformer implements VersionTransformer {
  readonly fromVersion: ArchiveVersion = "1.9.0"
  readonly toVersion: ArchiveVersion = "1.10.0"

  transform(data: ArchiveData): TransformResult {
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

    return {
      data: {
        ...data,
        manifest: { ...data.manifest, version: this.toVersion },
        tagsData: {
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
        },
        subjectsData: undefined, // remove old field
      },
      warnings,
    }
  }
}
