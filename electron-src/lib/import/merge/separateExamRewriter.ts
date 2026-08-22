/**
 * 「別で追加する」（別の試験として取り込む）ための id 振り直し
 *
 * 試験IDが既存と一致していても、人が「別で追加する」を選んだときは、
 * 取り込み側のデータが既存の行を指してはいけない。取り込みの各処理は
 * 「その id の行が既にあるなら、それを使う」で書かれている（＝同じ id なら
 * 既存の試験の行にぶら下がる）ので、**DBへ触る前にアーカイブ側の id を振り直す**。
 *
 * 振り直す対象は試験にぶら下がる行だけ。生徒・学級・小計グループ・タグ・利用者は
 * 試験をまたいで共有される実体なので、そのまま既存の紐づけ処理（idMappings）に載せる。
 *
 * 振り直した後は、そのデータは「取り込み先に一度も入っていないアーカイブ」と同じ形に
 * なる。だから後段は何も知らなくてよく、idMappings は今までどおり
 * 「アーカイブ側の id → 取り込み先の id」を運ぶ（振り直した id がアーカイブ側の id に
 * なるだけで、id の運び方に二つ目の流儀を持ち込まない）。
 */

import * as crypto from "crypto"

import type {
  ArchiveExamData,
  ArchiveManifest,
  ArchiveScoresData,
  ArchiveSubtotalsData,
  ArchiveTagsData,
} from "../../../../src/types/examArchive.types"
import type { ExtractedArchiveData } from "../exam-archive/archiveExtractor"

/** 試験にぶら下がる行だけを含む、id の置換対象となる断面 */
interface ExamScopedSections {
  manifest: ArchiveManifest
  examData: ArchiveExamData
  scoresData: ArchiveScoresData
  subtotalsData: ArchiveSubtotalsData
  tagsData: ArchiveTagsData
}

/**
 * uuid（8-4-4-4-12 の16進）1個ぶんの並び。
 *
 * `g` 付きの正規表現をモジュール直下に置いているが、`String.prototype.replace` は
 * 呼ぶたびに `lastIndex` を 0 へ戻すので、使い回しても取りこぼさない。
 */
const UUID_PATTERN =
  /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g

/**
 * 値の中に現れる古い id を、新しい id へ置き換えた同じ形の値を返す。
 *
 * 置換は JSON テキストの上で行う。**参照している列を1つずつ名指ししないため**で、
 * 列を数え落として参照だけが古い id を指したまま残る、という壊れ方をしない。
 * さらに ReturnSnapshot.scoresJson のように **文字列の中に JSON として畳まれた
 * cropRegionId** も同時に直る（構造をたどる置換では届かない）。
 *
 * **走査は1回。** id ごとに全文を `split/join` すると、走査回数が id の数だけ増える
 * （200名規模で約25,000件 × 約20MB ＝ 実質固まる）。代わりに **uuid の形をした並びだけを
 * 拾って表を引く** —— 走査は1回で済み、しかも「たまたま id を部分文字列として含む値」を
 * 巻き込む余地が消える（拾うのは uuid 1個ぶんの並びに完全に重なる箇所だけ）。
 *
 * id が uuid であることはアプリ全体の不変式
 * （`__tests__/import-export/unit/uuidIdCoverage.test.ts` が schema とソースで固定している）。
 */
function withReplacedIds<T>(
  value: T,
  newIdByOldId: ReadonlyMap<string, string>
): T {
  const serialized = JSON.stringify(value)
  const replaced = serialized.replace(
    UUID_PATTERN,
    (uuid) => newIdByOldId.get(uuid) ?? uuid
  )
  return JSON.parse(replaced)
}

/**
 * 試験にぶら下がる行の id を集める。
 *
 * **ここに挙げるのは「その行自身の id」だけでよい**（参照している列は
 * withReplacedIds が値として拾う）。試験に新しいテーブルをぶら下げたら
 * ここに1行足すこと。
 */
function collectExamScopedIds(data: ExtractedArchiveData): string[] {
  const { examData, scoresData, subtotalsData, tagsData } = data
  const idsOf = (rows: Array<{ id: string }>): string[] =>
    rows.map((row) => row.id)

  return [
    examData.exam.id,
    ...idsOf(examData.examPages),
    ...idsOf(examData.cropRegions),
    ...idsOf(examData.omrConfigs ?? []),
    ...idsOf(examData.omrChoiceOptions ?? []),
    ...idsOf(examData.compoundAnswers ?? []),
    ...idsOf(examData.compoundAnswerMembers ?? []),
    ...idsOf(examData.compoundAnswerScores ?? []),
    ...idsOf(examData.studentAnswerImages ?? []),
    // 旧形式（変換チェーンが畳んだ後は空だが、読み落としを作らないため数える）
    ...idsOf(examData.pageImages),
    ...idsOf(examData.masterImages ?? []),
    ...idsOf(examData.examStudents),
    ...idsOf(examData.userExams),
    ...idsOf(examData.examSubtotalGroups),
    ...idsOf(examData.examClassrooms),
    ...idsOf(examData.answerOverlayStyles ?? []),
    ...idsOf(examData.answerOverlayVisibilities ?? []),
    ...idsOf(
      examData.individualReportSettings
        ? [examData.individualReportSettings]
        : []
    ),
    ...idsOf(examData.individualReportTableSections ?? []),
    ...idsOf(examData.individualReportStatisticVisibilities ?? []),
    ...idsOf(
      examData.individualReportGraphSettings
        ? [examData.individualReportGraphSettings]
        : []
    ),
    ...idsOf(scoresData.questionScores),
    ...idsOf(scoresData.drawingAnnotations),
    ...idsOf(scoresData.scoreDecisions ?? []),
    ...idsOf(scoresData.returnSnapshots ?? []),
    // 設問と小計の紐づけは設問側の持ち物（小計そのものは試験をまたいで共有される）
    ...idsOf(subtotalsData.cropSubtotals),
    // 試験へのタグ付けは試験側の持ち物（タグそのものは共有される）
    ...idsOf(tagsData.examTags),
  ]
}

/**
 * 試験にぶら下がる id を全て振り直したアーカイブデータを返す。
 *
 * 画像ファイルの実体（masterImagePaths / answerSheetPaths）は展開先の実パスなので触らない。
 * 置き先は取り込み側が新しい試験IDで組み立て直す。
 */
export function rewriteAsSeparateExam(
  data: ExtractedArchiveData
): ExtractedArchiveData {
  const newIdByOldId = new Map<string, string>(
    collectExamScopedIds(data).map((oldId) => [oldId, crypto.randomUUID()])
  )

  const sections: ExamScopedSections = {
    manifest: data.manifest,
    examData: data.examData,
    scoresData: data.scoresData,
    subtotalsData: data.subtotalsData,
    tagsData: data.tagsData,
  }

  return { ...data, ...withReplacedIds(sections, newIdByOldId) }
}
