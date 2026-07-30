/**
 * 1.12.0 → 1.13.0: 成績本体をテーブルごとの平坦なセクションへ展開する。
 *
 * 1.12.0 までは成績本体を入れ子へ射影し、外部参照（生徒・評価項目）を名前で持っていた。
 * DB の行の形と対応が取れず、列を足すたびに射影と復元の両方を書く必要があった。
 * 1.13.0 では exam / coursework と同じく Prisma の行をそのまま持つ。
 *
 * 展開の詳細（id を持たない行の id の組み立て、名前参照の解決）は legacyShape が担う。
 */

import type { GradeArchiveVersion } from "../../../../src/types/gradeArchive.types"
import { flattenLegacyGrade } from "./legacyShape"
import type {
  AnyGradeArchiveData,
  GradeTransformResult,
  GradeVersionTransformer,
} from "./types"
import { isGradeArchiveUpTo1_12_0 } from "./types"

/** 内包資料が空のときの既定値。1.12.0 の変換で必ず埋まっているはずだが念のため */
const EMPTY_COURSEWORK_ARCHIVE = {
  courseworks: [],
  courseworkClassrooms: [],
  courseworkTags: [],
  courseworkStudents: [],
  courseworkItems: [],
  courseworkLetterScales: [],
  courseworkScores: [],
  studentsData: [],
  classesData: [],
  membershipsData: [],
  tagsData: [],
  counts: { courseworks: 0, items: 0, scores: 0, students: 0, classrooms: 0 },
}

export class V1_12_0_to_V1_13_0_Transformer implements GradeVersionTransformer {
  readonly fromVersion: GradeArchiveVersion = "1.12.0"
  readonly toVersion: GradeArchiveVersion = "1.13.0"

  transform(data: AnyGradeArchiveData): GradeTransformResult {
    if (!isGradeArchiveUpTo1_12_0(data)) {
      return { data, warnings: [] }
    }

    const flattened = flattenLegacyGrade(data)
    const warnings = [...flattened.warnings]

    // 旧形式は行の作成日時を持ち出していない。復元できないので下限値を入れている
    warnings.push(
      "1.12.0→1.13.0: 旧アーカイブは各行の作成日時を持たないため、取り込み時に現在時刻で作り直します"
    )

    return {
      data: {
        manifest: { ...data.manifest, version: this.toVersion },
        ...flattened.sections,
        studentsData: flattened.studentsData,
        classesData: flattened.classesData,
        membershipsData: flattened.membershipsData,
        examRefs: flattened.examRefs,
        subtotalRefs: flattened.subtotalRefs,
        cropRegionRefs: flattened.cropRegionRefs,
        courseworkArchive: data.courseworkArchive ?? EMPTY_COURSEWORK_ARCHIVE,
      },
      warnings,
    }
  }
}
