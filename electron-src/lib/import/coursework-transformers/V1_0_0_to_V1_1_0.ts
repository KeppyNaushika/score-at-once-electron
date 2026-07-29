/**
 * coursework-archive 1.0.0 → 1.1.0
 *
 * 入れ子・射影形式（資料1件のツリー）を、テーブルごとの平坦なセクションへ展開する。
 * 併せて点数の参照を人（Student）から資料の対象者（CourseworkStudent）へ付け替え、
 * 名簿に載っていない生徒の点数（孤児）を破棄する（#962 Phase B）。
 *
 * 展開の実体は legacyShape に置き、.grade が内包する資料の変換と共有する。
 */

import type { CourseworkArchiveVersion } from "../../../../src/types/courseworkArchive.types"
import { flattenLegacyCourseworks } from "./legacyShape"
import {
  type AnyCourseworkArchiveData,
  type CourseworkTransformResult,
  type CourseworkVersionTransformer,
  isCourseworkArchiveV1_0_0,
} from "./types"

export class V1_0_0_to_V1_1_0_Transformer implements CourseworkVersionTransformer {
  readonly fromVersion: CourseworkArchiveVersion = "1.0.0"
  readonly toVersion: CourseworkArchiveVersion = "1.1.0"

  transform(data: AnyCourseworkArchiveData): CourseworkTransformResult {
    // 既に平坦なら通す（チェーンの冪等性）
    if (!isCourseworkArchiveV1_0_0(data)) {
      return {
        data: {
          ...data,
          manifest: { ...data.manifest, version: this.toVersion },
        },
        warnings: [],
      }
    }

    const { sections, discardedScoreCount } = flattenLegacyCourseworks(
      data.courseworks
    )

    const warnings = [
      "1.0.0→1.1.0: 資料データをテーブルごとの形式へ変換しました（作成・更新時刻は旧形式に無いため復元できません）",
    ]
    if (discardedScoreCount > 0) {
      warnings.push(
        `1.0.0→1.1.0: 対象生徒として登録されていない生徒の点数 ${discardedScoreCount} 件を破棄しました`
      )
    }

    return {
      data: {
        manifest: { ...data.manifest, version: this.toVersion },
        ...sections,
        studentsData: data.studentsData,
        classesData: data.classesData,
        membershipsData: data.membershipsData,
        tagsData: data.tagsData,
      },
      warnings,
    }
  }
}
