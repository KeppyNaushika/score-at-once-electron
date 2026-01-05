/**
 * v1.0.0 → v1.1.0 変換器
 *
 * アプリバージョン: v0.2.x → v0.3.x
 *
 * 主な変更点:
 * - UserProject: invitedAt, invitedBy フィールド追加
 * - ProjectClass テーブル追加
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
 * v1.0.0 の UserProject 形式
 */
interface V1_0_0_UserProject {
  id: string
  userId: string
  projectId: string
  role?: string // v0.2.20では存在するが、それ以前はない場合がある
  createdAt: string
  updatedAt: string
}

/**
 * v1.1.0 の UserProject 形式
 */
interface V1_1_0_UserProject {
  id: string
  userId: string
  projectId: string
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

    // UserProject の変換
    const transformedUserProjects = this.transformUserProjects(
      data.projectData.userProjects as unknown as V1_0_0_UserProject[]
    )

    // projectClasses が存在しない場合は空配列で初期化
    const projectClasses = data.projectData.projectClasses ?? []

    // 警告メッセージを追加
    warnings.push(
      `アーカイブはv0.2.x形式(archive v${this.fromVersion})で作成されています。` +
        `UserProject.invitedAt/invitedByはデフォルト値で補完されました。`
    )

    return {
      data: {
        ...data,
        manifest: {
          ...data.manifest,
          version: this.toVersion,
        },
        projectData: {
          ...data.projectData,
          userProjects:
            transformedUserProjects as unknown as typeof data.projectData.userProjects,
          projectClasses,
        },
      },
      warnings,
    }
  }

  /**
   * UserProject を v1.1.0 形式に変換
   */
  private transformUserProjects(
    userProjects: V1_0_0_UserProject[]
  ): V1_1_0_UserProject[] {
    return userProjects.map((up, index) => {
      // roleが存在する場合は保持、なければデフォルト値を設定
      // 最初のユーザーはOWNER、それ以外はGRADER
      const role = up.role ?? (index === 0 ? "OWNER" : "GRADER")

      return {
        ...up,
        role,
        invitedAt: up.createdAt, // createdAtで代用
        invitedBy: index === 0 ? null : (userProjects[0]?.userId ?? null),
      }
    })
  }
}
