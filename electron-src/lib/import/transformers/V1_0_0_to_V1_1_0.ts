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
 * @see docs/schema-history/README.md
 */

import type {
  ArchiveData,
  ArchiveVersion,
  TransformResult,
  VersionTransformer,
} from "./types"

/**
 * v1.0.0 の UserExam 形式
 */
interface V1_0_0_UserExam {
  id: string
  userId: string
  examId: string
  role?: string // v0.2.20では存在するが、それ以前はない場合がある
  createdAt: string
  updatedAt: string
}

/**
 * v1.1.0 の UserExam 形式
 */
interface V1_1_0_UserExam {
  id: string
  userId: string
  examId: string
  role: string
  invitedAt: string
  invitedBy: string | null
  createdAt: string
  updatedAt: string
}

/**
 * v1.0.0 → v1.1.0 変換器
 */
export class V1_0_0_to_V1_1_0_Transformer implements VersionTransformer {
  readonly fromVersion: ArchiveVersion = "1.0.0"
  readonly toVersion: ArchiveVersion = "1.1.0"

  transform(data: ArchiveData): TransformResult {
    const warnings: string[] = []

    // UserExam の変換（旧フォーマットからの配列をバリデーション）
    const rawUserExams = data.examData.userExams as unknown[]
    const oldUserExams: V1_0_0_UserExam[] = Array.isArray(rawUserExams)
      ? rawUserExams.filter(
          (item): item is V1_0_0_UserExam =>
            typeof item === "object" &&
            item !== null &&
            "id" in item &&
            "userId" in item &&
            "examId" in item
        )
      : []

    const transformedUserExams = this.transformUserExams(oldUserExams)

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
          ...data.examData,
          userExams: transformedUserExams,
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
