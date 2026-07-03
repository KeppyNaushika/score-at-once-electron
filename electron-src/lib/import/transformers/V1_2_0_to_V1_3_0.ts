/**
 * v1.2.0 → v1.3.0 変換器
 *
 * アプリバージョン: v0.4.x → v0.5.x
 *
 * 主な変更点:
 * - Student.studentId → Student.studentNumber にリネーム
 *   - 学籍番号フィールド名の明確化（FKのstudentIdとの混同を防ぐ）
 *
 * @see docs/schema-history/README.md
 */

import type {
  ArchiveData,
  ArchiveVersion,
  TransformResult,
  VersionTransformer,
} from "./types"

/**
 * v1.2.0 の Student 形式（旧フィールド名）
 */
interface V1_2_0_Student {
  id: string
  studentId: string // 旧フィールド名
  lastName: string
  firstName: string
  lastNameKana: string
  firstNameKana: string
  enrollmentYear: number | null
  createdAt: string
  updatedAt: string
}

/**
 * v1.3.0 の Student 形式（新フィールド名）
 */
interface V1_3_0_Student {
  id: string
  studentNumber: string // 新フィールド名
  lastName: string
  firstName: string
  lastNameKana: string
  firstNameKana: string
  enrollmentYear: number | null
  createdAt: string
  updatedAt: string
}

/**
 * v1.2.0 → v1.3.0 変換器
 *
 * Student.studentId → Student.studentNumber のリネーム変換を行う
 */
export class V1_2_0_to_V1_3_0_Transformer implements VersionTransformer {
  readonly fromVersion: ArchiveVersion = "1.2.0"
  readonly toVersion: ArchiveVersion = "1.3.0"

  transform(data: ArchiveData): TransformResult {
    const warnings: string[] = []

    // Student データの変換（旧フォーマット配列をバリデーション）
    const rawStudents = data.studentsData.students as unknown[]
    const oldStudents: V1_2_0_Student[] = Array.isArray(rawStudents)
      ? rawStudents.filter(
          (item): item is V1_2_0_Student =>
            typeof item === "object" && item !== null && "id" in item
        )
      : []
    const transformedStudents = this.transformStudents(oldStudents)

    // 変換メッセージ
    warnings.push(
      `アーカイブはv0.4.x形式(archive v${this.fromVersion})で作成されています。` +
        `Studentの学籍番号フィールドがstudentIdからstudentNumberにリネームされました。`
    )

    return {
      data: {
        ...data,
        manifest: {
          ...data.manifest,
          version: this.toVersion,
        },
        studentsData: {
          students: transformedStudents.map((student) => ({ ...student })),
        },
      },
      warnings,
    }
  }

  /**
   * Student データを変換（studentId → studentNumber）
   */
  private transformStudents(students: V1_2_0_Student[]): V1_3_0_Student[] {
    return students.map((student) => {
      // studentId または studentNumber のどちらかが存在する場合に対応
      // Record型で旧新フィールド名を安全にチェック
      const studentRecord = { ...student } as Record<string, unknown>
      const studentNumber =
        (typeof studentRecord.studentNumber === "string"
          ? studentRecord.studentNumber
          : "") ||
        (typeof studentRecord.studentId === "string"
          ? studentRecord.studentId
          : "") ||
        ""

      return {
        id: student.id,
        studentNumber,
        lastName: student.lastName,
        firstName: student.firstName,
        lastNameKana: student.lastNameKana,
        firstNameKana: student.firstNameKana,
        enrollmentYear: student.enrollmentYear,
        createdAt: student.createdAt,
        updatedAt: student.updatedAt,
      }
    })
  }
}
