/**
 * v1.0.0 → v1.1.0 変換器
 *
 * アプリバージョン: v0.2.x → v0.3.x
 *
 * 主な変更点:
 * - UserExam: invitedAt, invitedBy フィールド追加
 * - ExamClassroom テーブル追加
 * - その他新規テーブル追加（インポート時は空で初期化）
 *
 * 当時のDBスキーマ: `git show v0.2.21-alpha.0:prisma/schema.prisma`
 * （ただし本変換器が扱うのはアーカイブJSONの形状であり、DBスキーマとは一致しない。
 *   旧形状は下の V1_0_0_* 型が正）
 */

import type {
  ExamArchiveData,
  ExamArchiveVersion,
  ExamTransformResult,
  ExamVersionTransformer,
} from "../../../../src/types/examArchive.types"

/**
 * v1.0.0 の UserExam 形式
 * （実アーカイブのフィールドは projectId。examId は将来キーとの両対応）
 */
interface V1_0_0_UserExam {
  id: string
  userId: string
  examId?: string
  projectId?: string
  role?: string // v0.2.20では存在するが、それ以前はない場合がある
  createdAt: string
  updatedAt: string
}

/**
 * v1.1.0 の UserExam 形式
 * （projectId → examId のリネームは V1_4_0→V1_5_0 が担当）
 */
interface V1_1_0_UserExam {
  id: string
  userId: string
  examId?: string
  projectId?: string
  role: string
  invitedAt: string
  invitedBy: string | null
  createdAt: string
  updatedAt: string
}

/**
 * v1.0.0 → v1.1.0 変換器
 */
export class V1_0_0_to_V1_1_0_Transformer implements ExamVersionTransformer {
  readonly fromVersion: ExamArchiveVersion = "1.0.0"
  readonly toVersion: ExamArchiveVersion = "1.1.0"

  transform(data: ExamArchiveData): ExamTransformResult {
    const warnings: string[] = []

    // UserExam の変換（旧フォーマットからの配列をバリデーション）
    // v1.0.0 実アーカイブのキーは userProjects（Project→Exam リネームは v1.5.0）
    const examDataRecord = data.examData as unknown as Record<string, unknown>
    const rawUserExams = (examDataRecord.userProjects ??
      examDataRecord.userExams) as unknown[]
    const oldUserExams: V1_0_0_UserExam[] = Array.isArray(rawUserExams)
      ? rawUserExams.filter(
          (item): item is V1_0_0_UserExam =>
            typeof item === "object" &&
            item !== null &&
            "id" in item &&
            "userId" in item &&
            ("examId" in item || "projectId" in item)
        )
      : []

    const transformedUserExams = this.transformUserExams(oldUserExams)

    // userExams へ集約したので旧キーは捨てる（V1_4_0→V1_5_0 の一括リネームと重複させない）
    const examDataWithoutLegacyKeys = { ...examDataRecord }
    delete examDataWithoutLegacyKeys.userProjects

    // examClassrooms が存在しない場合は空配列で初期化
    const examClassrooms = data.examData.examClassrooms ?? []

    // 警告メッセージを追加
    warnings.push(
      `アーカイブはv0.2.x形式(archive v${this.fromVersion})で作成されています。` +
        `UserExam.invitedAt/invitedByはデフォルト値で補完されました。`
    )

    return {
      data: {
        ...data,
        manifest: {
          ...data.manifest,
          version: this.toVersion,
        },
        examData: {
          ...(examDataWithoutLegacyKeys as unknown as typeof data.examData),
          // projectId → examId のリネームは V1_4_0→V1_5_0 が担当するため中間形状のまま持ち回る
          userExams:
            transformedUserExams as unknown as typeof data.examData.userExams,
          examClassrooms,
        },
      },
      warnings,
    }
  }

  /**
   * UserExam を v1.1.0 形式に変換
   */
  private transformUserExams(userExams: V1_0_0_UserExam[]): V1_1_0_UserExam[] {
    return userExams.map((userExam, index) => {
      // roleが存在する場合は保持、なければデフォルト値を設定
      // 最初のユーザーはOWNER、それ以外はGRADER
      const role = userExam.role ?? (index === 0 ? "OWNER" : "GRADER")

      return {
        ...userExam,
        role,
        invitedAt: userExam.createdAt, // createdAtで代用
        invitedBy: index === 0 ? null : (userExams[0]?.userId ?? null),
      }
    })
  }
}
