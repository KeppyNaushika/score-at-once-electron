/**
 * バージョン別インポーター
 *
 * v0.2.z 以前のアーカイブ形式を v0.3.0 形式に変換
 */

import type {
  ArchiveClassesData,
  ArchiveManifest,
  ArchiveProjectData,
  ArchiveScoresData,
  ArchiveStudentsData,
  ArchiveSubtotalsData,
  ArchiveUsersData,
} from "../../../types/projectArchive.types"

// =============================================================================
// Version Detection
// =============================================================================

/**
 * アーカイブバージョンの種類
 */
export type ArchiveVersion = "1.0.0" | "1.1.0" | "unknown"

/**
 * バージョン文字列を比較
 *
 * @returns 負: v1 < v2, 0: v1 == v2, 正: v1 > v2
 */
function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split(".").map(Number)
  const parts2 = v2.split(".").map(Number)

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0
    const p2 = parts2[i] || 0
    if (p1 !== p2) {
      return p1 - p2
    }
  }
  return 0
}

/**
 * マニフェストからバージョンを検出
 */
export function detectArchiveVersion(
  manifest: ArchiveManifest
): ArchiveVersion {
  const version = manifest.version

  // v0.2.z (archive format 1.0.0)
  if (compareVersions(version, "1.1.0") < 0) {
    return "1.0.0"
  }

  // v0.3.0+ (archive format 1.1.0)
  if (
    compareVersions(version, "1.1.0") >= 0 &&
    compareVersions(version, "2.0.0") < 0
  ) {
    return "1.1.0"
  }

  return "unknown"
}

// =============================================================================
// Data Transformation Types
// =============================================================================

/**
 * v0.2.z (1.0.0) のUserProject形式
 *
 * v0.2.20時点では role は存在する（デフォルト "OWNER"）
 * v0.2.z では invitedAt, invitedBy がない
 */
interface V1_0_0_UserProject {
  id: string
  userId: string
  projectId: string
  role?: string // v0.2.20では存在する
  createdAt: string
  updatedAt: string
}

/**
 * v0.3.0 (1.1.0) のUserProject形式
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

// =============================================================================
// Version Transformers
// =============================================================================

/**
 * バージョン別変換インターフェース
 */
export interface VersionTransformer {
  /** 対応するアーカイブバージョン */
  supportedVersion: ArchiveVersion
  /** プロジェクトデータを変換 */
  transformProjectData(data: ArchiveProjectData): ArchiveProjectData
  /** 生徒データを変換 */
  transformStudentsData(data: ArchiveStudentsData): ArchiveStudentsData
  /** クラスデータを変換 */
  transformClassesData(data: ArchiveClassesData): ArchiveClassesData
  /** ユーザーデータを変換 */
  transformUsersData(data: ArchiveUsersData): ArchiveUsersData
  /** 小計データを変換 */
  transformSubtotalsData(data: ArchiveSubtotalsData): ArchiveSubtotalsData
  /** 採点データを変換 */
  transformScoresData(data: ArchiveScoresData): ArchiveScoresData
  /** マニフェストを変換 */
  transformManifest(manifest: ArchiveManifest): ArchiveManifest
}

/**
 * v1.0.0 → v1.1.0 変換器
 *
 * v0.2.z のアーカイブを v0.3.0 形式に変換
 */
export class V1_0_0_Transformer implements VersionTransformer {
  supportedVersion: ArchiveVersion = "1.0.0"

  transformProjectData(data: ArchiveProjectData): ArchiveProjectData {
    // UserProjectにinvitedAt, invitedByを追加
    // v0.2.20では role は既に存在するので、あれば保持、なければデフォルト値を設定
    const transformedUserProjects = data.userProjects.map((up, index) => {
      const v1Up = up as unknown as V1_0_0_UserProject

      // roleが存在する場合は保持、なければデフォルト値を設定
      // 最初のユーザーはOWNER、それ以外はGRADER
      const role = v1Up.role ?? (index === 0 ? "OWNER" : "GRADER")

      const v11Up: V1_1_0_UserProject = {
        ...v1Up,
        role,
        invitedAt: v1Up.createdAt,
        invitedBy: null,
      }
      return v11Up as unknown as ArchiveProjectData["userProjects"][0]
    })

    // invitedByを設定（最初のユーザー以外）
    if (transformedUserProjects.length > 1) {
      const ownerUserId = transformedUserProjects[0]?.userId
      for (let i = 1; i < transformedUserProjects.length; i++) {
        const up = transformedUserProjects[i] as unknown as V1_1_0_UserProject
        up.invitedBy = ownerUserId || null
      }
    }

    // v0.2.zにはprojectClassesがないので空の配列を追加
    const projectClasses = data.projectClasses ?? []

    return {
      ...data,
      userProjects: transformedUserProjects,
      projectClasses,
    }
  }

  transformStudentsData(data: ArchiveStudentsData): ArchiveStudentsData {
    // v0.2.z → v0.3.0 での生徒データの変更はなし
    return data
  }

  transformClassesData(data: ArchiveClassesData): ArchiveClassesData {
    // v0.2.z → v0.3.0 でのクラスデータの変更はなし
    return data
  }

  transformUsersData(data: ArchiveUsersData): ArchiveUsersData {
    // v0.2.z → v0.3.0 でのユーザーデータの変更はなし
    return data
  }

  transformSubtotalsData(data: ArchiveSubtotalsData): ArchiveSubtotalsData {
    // v0.2.z → v0.3.0 での小計データの変更はなし
    return data
  }

  transformScoresData(data: ArchiveScoresData): ArchiveScoresData {
    // v0.2.z → v0.3.0 での採点データの変更はなし
    return data
  }

  transformManifest(manifest: ArchiveManifest): ArchiveManifest {
    return {
      ...manifest,
      // バージョンを最新に更新
      version: "1.1.0",
      schemaVersion: manifest.schemaVersion || "unknown",
    }
  }
}

/**
 * v1.1.0 (現行バージョン) の変換器
 *
 * 変換不要、パススルー
 */
export class V1_1_0_Transformer implements VersionTransformer {
  supportedVersion: ArchiveVersion = "1.1.0"

  transformProjectData(data: ArchiveProjectData): ArchiveProjectData {
    return data
  }

  transformStudentsData(data: ArchiveStudentsData): ArchiveStudentsData {
    return data
  }

  transformClassesData(data: ArchiveClassesData): ArchiveClassesData {
    return data
  }

  transformUsersData(data: ArchiveUsersData): ArchiveUsersData {
    return data
  }

  transformSubtotalsData(data: ArchiveSubtotalsData): ArchiveSubtotalsData {
    return data
  }

  transformScoresData(data: ArchiveScoresData): ArchiveScoresData {
    return data
  }

  transformManifest(manifest: ArchiveManifest): ArchiveManifest {
    return manifest
  }
}

// =============================================================================
// Transformer Factory
// =============================================================================

/**
 * バージョンに応じた変換器を取得
 */
export function getTransformer(version: ArchiveVersion): VersionTransformer {
  switch (version) {
    case "1.0.0":
      return new V1_0_0_Transformer()
    case "1.1.0":
      return new V1_1_0_Transformer()
    default:
      // 未知のバージョンはパススルー（警告付き）
      console.warn(
        `Unknown archive version: ${version}, using passthrough transformer`
      )
      return new V1_1_0_Transformer()
  }
}

/**
 * マニフェストから適切な変換器を取得
 */
export function getTransformerFromManifest(
  manifest: ArchiveManifest
): VersionTransformer {
  const version = detectArchiveVersion(manifest)
  return getTransformer(version)
}

// =============================================================================
// Archive Data Transformation
// =============================================================================

/**
 * 展開されたアーカイブデータ
 */
export interface ExtractedArchiveData {
  manifest: ArchiveManifest
  projectData: ArchiveProjectData
  studentsData: ArchiveStudentsData
  classesData: ArchiveClassesData
  usersData: ArchiveUsersData
  subtotalsData: ArchiveSubtotalsData
  scoresData: ArchiveScoresData
  tempDir: string
  /** マスター画像のパス一覧 (展開後のフルパス) */
  masterImagePaths: string[]
  /** 答案画像のパス一覧 (展開後のフルパス) */
  answerSheetPaths: string[]
}

/**
 * 変換済みアーカイブデータ
 */
export interface TransformedArchiveData extends ExtractedArchiveData {
  /** 変換前のバージョン */
  originalVersion: ArchiveVersion
  /** 変換時の警告 */
  transformWarnings: string[]
}

/**
 * アーカイブデータを最新形式に変換
 */
export function transformArchiveData(
  data: ExtractedArchiveData
): TransformedArchiveData {
  const originalVersion = detectArchiveVersion(data.manifest)
  const transformer = getTransformer(originalVersion)
  const warnings: string[] = []

  // 古いバージョンからの変換の場合は警告を追加
  if (originalVersion === "1.0.0") {
    warnings.push(
      `アーカイブは古い形式(v${originalVersion})で作成されています。` +
        `一部のデータ（ユーザー権限等）はデフォルト値で補完されました。`
    )
  }

  return {
    manifest: transformer.transformManifest(data.manifest),
    projectData: transformer.transformProjectData(data.projectData),
    studentsData: transformer.transformStudentsData(data.studentsData),
    classesData: transformer.transformClassesData(data.classesData),
    usersData: transformer.transformUsersData(data.usersData),
    subtotalsData: transformer.transformSubtotalsData(data.subtotalsData),
    scoresData: transformer.transformScoresData(data.scoresData),
    tempDir: data.tempDir,
    masterImagePaths: data.masterImagePaths,
    answerSheetPaths: data.answerSheetPaths,
    originalVersion,
    transformWarnings: warnings,
  }
}

/**
 * バージョン変換が必要か確認
 */
export function requiresTransformation(manifest: ArchiveManifest): boolean {
  const version = detectArchiveVersion(manifest)
  return version !== "1.1.0"
}

/**
 * サポートされているバージョンか確認
 */
export function isSupportedVersion(manifest: ArchiveManifest): boolean {
  const version = detectArchiveVersion(manifest)
  return version !== "unknown"
}
