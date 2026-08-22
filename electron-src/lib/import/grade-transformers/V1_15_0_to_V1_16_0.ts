/**
 * 1.15.0 → 1.16.0: 成績にタグを持たせ、日付のキー名を referenceDate へ揃える。
 *
 * 1つの版で2つ運ぶのは、どちらも同じスキーマ変更（段階64）で同時に入るからである。
 * 「タグは足したが日付はまだ examDate」というアーカイブを書き出したビルドは存在せず、
 * 2段に割ると誰も作れない中間の版が1つ増えるだけになる。
 *
 * 運ぶもの:
 * - `gradeTags` / `tagsData` セクションの新設。旧アーカイブには成績のタグが無いので
 *   空で補う（**空で埋めるのが正しい** —— 旧版では成績にタグを付ける手段が無く、
 *   失われたタグというものが存在しない）。よって警告も出さない
 * - 試験参照の日付キー `examDate` → `referenceDate`
 * - 内包資料（coursework 1.1.0）の実施日キー `date` → `referenceDate`。
 *   .grade は資料を丸ごと内包するので、資料側の版上げがそのまま .grade にも効く
 *
 * 値そのものは変わらない（キーの付け替えと空セクションの追加だけ）。
 */

import type { ArchiveCourseworkRow } from "../../../../src/types/courseworkArchive.types"
import type {
  ArchiveGradeExamRef,
  GradeArchiveVersion,
} from "../../../../src/types/gradeArchive.types"
import type {
  AnyGradeArchiveData,
  GradeTransformResult,
  GradeVersionTransformer,
} from "./types"
import { isGradeArchiveV1_15_0 } from "./types"

/** 試験参照の旧キー examDate を referenceDate へ移す */
const renameExamRefDate = (examRef: {
  id: string
  examName: string
  examDate: string | null
}): ArchiveGradeExamRef => ({
  id: examRef.id,
  examName: examRef.examName,
  referenceDate: examRef.examDate,
})

/**
 * 内包資料の行の旧キー date を referenceDate へ移す。
 *
 * 資料の版は .grade の版とは独立に決まる（extractor はどちらの形も読める）ので、
 * 引数の型で「新旧どちらのキーを持つかもしれない」と名乗り、両方を同じ関数へ渡せるようにする。
 */
const renameCourseworkDate = (
  coursework: Omit<ArchiveCourseworkRow, "referenceDate"> & {
    referenceDate?: unknown
    date?: unknown
  }
): ArchiveCourseworkRow => {
  const { date, ...rest } = coursework
  const referenceDate =
    typeof rest.referenceDate === "string"
      ? rest.referenceDate
      : typeof date === "string"
        ? date
        : null
  return { ...rest, referenceDate }
}

export class V1_15_0_to_V1_16_0_Transformer implements GradeVersionTransformer {
  readonly fromVersion: GradeArchiveVersion = "1.15.0"
  readonly toVersion: GradeArchiveVersion = "1.16.0"

  transform(data: AnyGradeArchiveData): GradeTransformResult {
    if (!isGradeArchiveV1_15_0(data)) {
      return { data, warnings: [] }
    }

    return {
      data: {
        ...data,
        manifest: { ...data.manifest, version: this.toVersion },
        // 旧版には成績のタグを付ける手段が無かったので、空が正しい既定
        gradeTags: [],
        tagsData: [],
        examRefs: data.examRefs.map(renameExamRefDate),
        courseworkArchive: {
          ...data.courseworkArchive,
          courseworks:
            data.courseworkArchive.courseworks.map(renameCourseworkDate),
        },
      },
      warnings: [],
    }
  }
}
