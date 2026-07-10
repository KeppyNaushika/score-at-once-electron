/**
 * v1.15.0 → v1.16.0 変換器（学級 Class→Classroom 全面リネーム）
 *
 * 主な変更点:
 * - JSON キーのリネーム: examClasses→examClassrooms, classes→classrooms,
 *   classId→classroomId, className→classroomName, classCode→classroomCode
 *   （normalizeLegacyClassroomKeys による再帰正規化）
 * - ExamClassroom.teacherStat → teacherStatistics リネーム
 */

import type {
  ExamArchiveData,
  ExamArchiveVersion,
  ExamTransformResult,
  ExamVersionTransformer,
} from "../../../../src/types/examArchive.types"
import { normalizeLegacyClassroomKeys } from "../shared/legacyClassroomKeys"

export class V1_15_0_to_V1_16_0_Transformer implements ExamVersionTransformer {
  readonly fromVersion: ExamArchiveVersion = "1.15.0"
  readonly toVersion: ExamArchiveVersion = "1.16.0"

  transform(data: ExamArchiveData): ExamTransformResult {
    const examData = normalizeLegacyClassroomKeys(data.examData)
    const classesData = normalizeLegacyClassroomKeys(data.classesData)

    const examClassrooms = (examData.examClassrooms ?? []).map(
      (examClassroom) => {
        const { teacherStat, ...rest } = examClassroom
        return {
          ...rest,
          teacherStatistics:
            examClassroom.teacherStatistics ?? teacherStat ?? false,
        }
      }
    )

    return {
      data: {
        ...data,
        manifest: { ...data.manifest, version: this.toVersion },
        examData: { ...examData, examClassrooms },
        classesData,
      },
      warnings: [
        "1.15.0→1.16.0: 学級キーを Classroom 系（examClassrooms/classroomId 等）へ正規化しました。",
      ],
    }
  }
}
