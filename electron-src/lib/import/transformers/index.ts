/**
 * 試験アーカイブ（.score）バージョン変換チェーン
 *
 * 旧バージョンのアーカイブを EXAM_TRANSFORMERS の連鎖適用で最新形式へ変換する
 * （coursework/asb/grade/student の transformers と同型）。
 *
 * 【バージョン検出は manifest.version ＋ 形状ベースの下方補正】
 * manifest.version は archiveCreator が EXAM_CURRENT_VERSION から書き込むため
 * 原則信頼できるが、リファクタ途中のビルドや手編集されたアーカイブでは
 * 実形状より新しい版数を名乗る可能性がある。そこで旧形式にしか現れない
 * 形状マーカー（examClasses キー、statistics フラグ、final/proposed 採点、
 * 大文字 status 等）を検出した場合は、そのマーカーを処理する変換器が
 * 必ず走るバージョンまで検出結果を引き下げる。
 *
 * 【引き下げの安全条件（重要）】
 * 一部の変換器は冪等でない（px→mm 変換、pageImages 分割等）ため、現行形式の
 * データを誤って引き下げるとデータを破壊する。よって各マーカーは
 * 「旧キーが存在し、かつ対応する現行キーが欠落している」場合のみ発火させる。
 * 旧キーと現行キーが併存する曖昧なアーカイブは manifest.version を信頼する。
 * 加えて、引き下げ先以降の変換器は可能な限り冪等に実装する
 * （既存値があれば保持し、欠落時のみデフォルト補完する）。
 */

import type {
  ArchiveManifest,
  ExamArchiveData,
  ExamArchiveVersion,
  ExamChainTransformResult,
  ExamVersionTransformer,
} from "../../../../src/types/examArchive.types"
import {
  EXAM_CURRENT_VERSION,
  EXAM_SUPPORTED_VERSIONS,
} from "../../../../src/types/examArchive.types"
import { compareVersions } from "../../shared/utilities/semver"
import {
  detectVersionInRange,
  runTransformChain,
} from "../shared/transformChain"
import { V1_0_0_to_V1_1_0_Transformer } from "./V1_0_0_to_V1_1_0"
import { V1_1_0_to_V1_2_0_Transformer } from "./V1_1_0_to_V1_2_0"
import { V1_2_0_to_V1_3_0_Transformer } from "./V1_2_0_to_V1_3_0"
import { V1_3_0_to_V1_4_0_Transformer } from "./V1_3_0_to_V1_4_0"
import { V1_4_0_to_V1_5_0_Transformer } from "./V1_4_0_to_V1_5_0"
import { V1_5_0_to_V1_6_0_Transformer } from "./V1_5_0_to_V1_6_0"
import { V1_6_0_to_V1_7_0_Transformer } from "./V1_6_0_to_V1_7_0"
import { V1_7_0_to_V1_8_0_Transformer } from "./V1_7_0_to_V1_8_0"
import { V1_8_0_to_V1_9_0_Transformer } from "./V1_8_0_to_V1_9_0"
import { V1_9_0_to_V1_10_0_Transformer } from "./V1_9_0_to_V1_10_0"
import { V1_10_0_to_V1_11_0_Transformer } from "./V1_10_0_to_V1_11_0"
import { V1_11_0_to_V1_12_0_Transformer } from "./V1_11_0_to_V1_12_0"
import { V1_12_0_to_V1_13_0_Transformer } from "./V1_12_0_to_V1_13_0"
import { V1_13_0_to_V1_14_0_Transformer } from "./V1_13_0_to_V1_14_0"
import { V1_14_0_to_V1_15_0_Transformer } from "./V1_14_0_to_V1_15_0"
import { V1_15_0_to_V1_16_0_Transformer } from "./V1_15_0_to_V1_16_0"
import { V1_16_0_to_V1_17_0_Transformer } from "./V1_16_0_to_V1_17_0"
import { V1_17_0_to_V1_18_0_Transformer } from "./V1_17_0_to_V1_18_0"
import { V1_18_0_to_V1_19_0_Transformer } from "./V1_18_0_to_V1_19_0"
import { V1_19_0_to_V1_20_0_Transformer } from "./V1_19_0_to_V1_20_0"
import { V1_20_0_to_V1_21_0_Transformer } from "./V1_20_0_to_V1_21_0"
import { V1_21_0_to_V1_22_0_Transformer } from "./V1_21_0_to_V1_22_0"

const EXAM_TRANSFORMERS: ExamVersionTransformer[] = [
  new V1_0_0_to_V1_1_0_Transformer(),
  new V1_1_0_to_V1_2_0_Transformer(),
  new V1_2_0_to_V1_3_0_Transformer(),
  new V1_3_0_to_V1_4_0_Transformer(),
  new V1_4_0_to_V1_5_0_Transformer(),
  new V1_5_0_to_V1_6_0_Transformer(),
  new V1_6_0_to_V1_7_0_Transformer(),
  new V1_7_0_to_V1_8_0_Transformer(),
  new V1_8_0_to_V1_9_0_Transformer(),
  new V1_9_0_to_V1_10_0_Transformer(),
  new V1_10_0_to_V1_11_0_Transformer(),
  new V1_11_0_to_V1_12_0_Transformer(),
  new V1_12_0_to_V1_13_0_Transformer(),
  new V1_13_0_to_V1_14_0_Transformer(),
  new V1_14_0_to_V1_15_0_Transformer(),
  new V1_15_0_to_V1_16_0_Transformer(),
  new V1_16_0_to_V1_17_0_Transformer(),
  new V1_17_0_to_V1_18_0_Transformer(),
  new V1_18_0_to_V1_19_0_Transformer(),
  new V1_19_0_to_V1_20_0_Transformer(),
  new V1_20_0_to_V1_21_0_Transformer(),
  new V1_21_0_to_V1_22_0_Transformer(),
]

/** マニフェストのバージョン文字列からサポート対象バージョンを判定する */
function detectVersionFromManifest(
  manifest: ArchiveManifest
): ExamArchiveVersion | "unknown" {
  return detectVersionInRange(manifest.version, EXAM_SUPPORTED_VERSIONS)
}

/** 学級レコード群（旧キー examClasses / 現行キー examClassrooms のどちらでも）を取り出す */
function rawExamClassroomRecords(
  data: ExamArchiveData
): Record<string, unknown>[] {
  const examDataRecord = data.examData as unknown as Record<string, unknown>
  const records = examDataRecord.examClassrooms ?? examDataRecord.examClasses
  return Array.isArray(records) ? (records as Record<string, unknown>[]) : []
}

/**
 * 旧形式にしか現れない形状マーカーと、それを処理する変換器が走る検出上限。
 * マーカー検出時はそのバージョン以下として扱う（下方補正）。
 *
 * 各マーカーは「旧キーが存在し、かつ対応する現行キーが欠落」の場合のみ発火する。
 * 現行データに旧キーの残骸が併存するだけでは発火しない（過剰引き下げは
 * 非冪等変換器 — px→mm・pageImages 分割 — によるデータ破壊を招くため）。
 */
/**
 * 採点層の行が「旧キー studentId を持ち、現行キー examStudentId を持たない」か。
 * `in` 演算子で判定するので、行の型を Record へ潰す必要が無い（`as` を使わない）。
 */
const hasLegacyStudentKey = (rows: readonly object[] | undefined): boolean =>
  (rows ?? []).some((row) => "studentId" in row && !("examStudentId" in row))

const SHAPE_VERSION_FLOORS: {
  maxVersion: ExamArchiveVersion
  marker: string
  applies: (data: ExamArchiveData) => boolean
}[] = [
  {
    // MasterImage/StudentAnswerImage 分離前の未分離 pageImages（V1_1_0_to_V1_2_0 が処理）
    maxVersion: "1.1.0",
    marker: "未分離の pageImages",
    applies: (data) => {
      const examDataRecord = data.examData as unknown as Record<string, unknown>
      return (
        Array.isArray(examDataRecord.pageImages) &&
        examDataRecord.pageImages.length > 0 &&
        !("masterImages" in examDataRecord) &&
        !("studentAnswerImages" in examDataRecord)
      )
    },
  },
  {
    // Project→Exam リネーム前のキー（V1_4_0_to_V1_5_0 が処理）。
    // 現行キーが併存する場合は発火しない（1.4.0 以下へ引き下げると
    // 非冪等な V1_7_0_to_V1_8_0 の px→mm 変換を再適用してしまうため）
    maxVersion: "1.4.0",
    marker: "project系キー",
    applies: (data) => {
      const examDataRecord = data.examData as unknown as Record<string, unknown>
      return (
        ("project" in examDataRecord && !("exam" in examDataRecord)) ||
        ("projectPages" in examDataRecord &&
          !("examPages" in examDataRecord)) ||
        ("projectStudents" in examDataRecord &&
          !("examStudents" in examDataRecord)) ||
        ("projectClasses" in examDataRecord &&
          !("examClassrooms" in examDataRecord) &&
          !("examClasses" in examDataRecord))
      )
    },
  },
  {
    // ScoreDecision 導入前の final/proposed 採点行（V1_12_0_to_V1_13_0 が処理）
    maxVersion: "1.12.0",
    marker: "final/proposed 採点行",
    applies: (data) =>
      (data.scoresData.questionScores ?? []).some(
        (questionScore) =>
          questionScore.status === "final" ||
          questionScore.status === "proposed"
      ),
  },
  {
    // 学級統計再設計前のフラグ形状（V1_14_0_to_V1_15_0 が処理）:
    // statistics 残存、または studentReport 欠落（administered からの補完が必要）
    maxVersion: "1.14.0",
    marker: "ExamClassroom.statistics / studentReport 欠落",
    applies: (data) =>
      rawExamClassroomRecords(data).some(
        (examClassroom) =>
          "statistics" in examClassroom || !("studentReport" in examClassroom)
      ),
  },
  {
    // Class→Classroom リネーム前のキー（V1_15_0_to_V1_16_0 が処理）:
    // トップレベルキー（examClasses/classes）とレコード内 classId の両方を検出
    maxVersion: "1.15.0",
    marker: "examClasses キー / teacherStat / classId",
    applies: (data) => {
      const examDataRecord = data.examData as unknown as Record<string, unknown>
      const classesDataRecord = data.classesData as unknown as Record<
        string,
        unknown
      >
      const memberships = Array.isArray(classesDataRecord.memberships)
        ? (classesDataRecord.memberships as Record<string, unknown>[])
        : []
      return (
        ("examClasses" in examDataRecord &&
          !("examClassrooms" in examDataRecord)) ||
        ("classes" in classesDataRecord &&
          !("classrooms" in classesDataRecord)) ||
        rawExamClassroomRecords(data).some(
          (examClassroom) =>
            "teacherStat" in examClassroom || "classId" in examClassroom
        ) ||
        memberships.some((membership) => "classId" in membership)
      )
    },
  },
  {
    // 大文字 status（V1_16_0_to_V1_17_0 が処理）
    maxVersion: "1.16.0",
    marker: "大文字 ExamStudent.status",
    applies: (data) =>
      (data.examData.examStudents ?? []).some(
        (examStudent) =>
          typeof examStudent.status === "string" &&
          examStudent.status !== examStudent.status.toLowerCase()
      ),
  },
  {
    // 採点層が ExamStudent 経由になる前の studentId キー（V1_20_0_to_V1_21_0 が処理）。
    // 現行キー examStudentId が併存する場合は発火しない（変換は非冪等で、
    // 2度目は解決できず全行を孤児として破棄してしまうため）。
    maxVersion: "1.20.0",
    marker: "採点層の studentId キー",
    applies: (data) =>
      [
        data.scoresData.questionScores,
        data.scoresData.scoreDecisions,
        data.scoresData.returnSnapshots,
        data.examData.studentAnswerImages,
        data.examData.compoundAnswerScores,
      ].some(hasLegacyStudentKey),
  },
]

/**
 * アーカイブの実効バージョンを判定する
 * （manifest.version を基点に、形状マーカーで下方補正）
 */
export function detectExamArchiveVersion(data: ExamArchiveData): {
  version: ExamArchiveVersion | "unknown"
  corrections: string[]
} {
  const manifestVersion = detectVersionFromManifest(data.manifest)
  if (manifestVersion === "unknown") {
    return { version: "unknown", corrections: [] }
  }

  let version: ExamArchiveVersion = manifestVersion
  const corrections: string[] = []
  for (const { maxVersion, marker, applies } of SHAPE_VERSION_FLOORS) {
    if (compareVersions(version, maxVersion) > 0 && applies(data)) {
      corrections.push(
        `アーカイブ(v${data.manifest.version})に旧形式の${marker}が含まれるため v${maxVersion} として読み込みます。`
      )
      version = maxVersion
    }
  }
  return { version, corrections }
}

/** アーカイブデータを変換チェーンを通じて最新バージョンへ変換する */
export function transformExamArchiveToLatest(
  data: ExamArchiveData,
  targetVersion: ExamArchiveVersion = EXAM_CURRENT_VERSION
): ExamChainTransformResult {
  const { version: originalVersion, corrections } =
    detectExamArchiveVersion(data)
  if (originalVersion === "unknown") {
    throw new Error(
      `Unknown exam archive version: ${data.manifest.version}. ` +
        `Supported versions: ${EXAM_SUPPORTED_VERSIONS.join(", ")}`
    )
  }
  return runTransformChain({
    data,
    originalVersion,
    targetVersion,
    transformers: EXAM_TRANSFORMERS,
    archiveLabel: "exam",
    initialWarnings: corrections,
  })
}
