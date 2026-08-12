/**
 * 答案返却スナップショット（ReturnSnapshot）の記録と差分検出。
 *
 * 「返却版として記録」操作で、その時点の有効スコア（resolveEffectiveScores の出力）と
 * 印刷対象の手書き注釈（DrawingAnnotation）を正規化シリアライズし、生徒×試験ごとに
 * 1行 upsert する（最新の返却版のみ保持）。
 *
 * 再印刷時は getReturnDiff で現在状態とスナップショットを「直接比較」し、
 * スコアまたは注釈に変更があった生徒を絞り込む。スコアはセル単位の before→after を、
 * 注釈は変更有無のフラグを返す（手描き図形の幾何差分は表示しない）。
 */

import { Decimal } from "@prisma/client/runtime/client"

import {
  calculateEffectiveScoreValue,
  type EffectiveScore,
  resolveEffectiveScores,
} from "../shared/calculations/scoreResolution"
import { recordAuditLog } from "./auditLog"
import { resolveExamScope } from "./auditScope"
import prisma from "./client"
import { getCropRegionsByExamId } from "./cropRegion"
import { getQuestionScoresForExam } from "./questionScore"
import { getScoreDecisionsForExam } from "./scoreDecision"

// ---- シリアライズ構造（scoresJson の中身） ----

/** 現在のスナップショットフォーマットのバージョン */
const SNAPSHOT_VERSION = 1

interface SnapshotScoreCell {
  /** cropRegionId */
  r: string
  /** status */
  s: string
  /** partialScore */
  p: number | null
}

// 捕捉する注釈フィールドは「実際にPDF印刷で使われるもの」に限定する
// （pdfExport.ts の annotations payload = pdfCanvasRenderer.ts の drawElement と一致）。
// textBoxWidth/Height・horizontalAlign/verticalAlign・isFavorite 等は印刷描画に
// 使われないため除外する（含めると印刷が同一でも誤検知になる）。出力経路がこれらを
// 使うようになったらここにも追加すること。
interface SnapshotAnnotation {
  r: string // cropRegionId
  t: string // type
  x: number
  y: number
  ex: number // endX
  ey: number // endY
  w: number // width
  h: number // height
  c: string // color
  sw: number // strokeWidth
  ls: string // lineStyle
  tx: string // text
  fs: number // fontSize
  dx: number // displayX
  dy: number // displayY
  ad: string // anchorDirection
}

interface SnapshotContent {
  v: number
  scores: SnapshotScoreCell[]
  annotations: SnapshotAnnotation[]
}

// ---- 公開する差分結果の型 ----

export interface ReturnScoreCellState {
  status: string
  partialScore: number | null
  /** 配点に基づく実得点（unscored は null） */
  value: number | null
}

interface ReturnScoreChange {
  cropRegionId: string
  label: string | null
  before: ReturnScoreCellState | null
  after: ReturnScoreCellState | null
}

export interface ReturnStudentDiff {
  examStudentId: string
  /** この生徒に返却版スナップショットが存在するか */
  hasSnapshot: boolean
  /** スコアまたは注釈に変更があったか（hasSnapshot が false の場合は常に false） */
  changed: boolean
  /** スナップショット記録日時（ISO text）。無ければ null */
  capturedAt: string | null
  /** セル単位のスコア差分（変更があったセルのみ） */
  scoreChanges: ReturnScoreChange[]
  /** 手書き注釈に変更があったか */
  annotationChanged: boolean
  /** 現在の合計点 */
  currentTotal: number | null
  /** 返却時点の合計点 */
  snapshotTotal: number | null
}

interface ReturnDiffResult {
  /** 1件でも返却版スナップショットが存在するか */
  hasAnySnapshot: boolean
  diffs: ReturnStudentDiff[]
}

interface CaptureReturnSnapshotResult {
  /** 記録した生徒数 */
  capturedCount: number
}

// ---- 内部ヘルパー ----

/** float のノイズによる誤検知を防ぐため小数4桁に丸める */
const round = (value: number): number => Math.round(value * 1e4) / 1e4

/**
 * 試験の現在状態（有効スコア・注釈・領域）をまとめて読み込む。
 *
 * 索引のキーは受験者（ExamStudent）と採点領域（CropRegion）の id で、人（Student）では
 * ない。返却スナップショットは「その試験の受験者の答案」を対象とするため、受験者を
 * 主語にするのが正しい（#962 §3.3 の棚卸し結果。Phase A の配線変更で解消済み）。
 */
interface ExamState {
  /** cropRegionId -> { label, maxScore } */
  regions: Map<string, { label: string | null; maxScore: number | null }>
  /** examStudentId -> 有効スコア配列 */
  effectiveByExamStudent: Map<string, EffectiveScore[]>
  /** examStudentId -> 正規化済み注釈配列（印刷対象のみ） */
  annotationsByExamStudent: Map<string, SnapshotAnnotation[]>
}

const loadExamState = async (examId: string): Promise<ExamState> => {
  const cropRegions = await getCropRegionsByExamId(examId)
  const regions = new Map<
    string,
    { label: string | null; maxScore: number | null }
  >()
  for (const cropRegion of cropRegions) {
    regions.set(cropRegion.id, {
      label: cropRegion.label ?? null,
      maxScore:
        cropRegion.points !== null && cropRegion.points !== undefined
          ? Number(cropRegion.points)
          : null,
    })
  }

  const scoresResult = await getQuestionScoresForExam(examId)
  const decisionsResult = await getScoreDecisionsForExam(examId)
  const { resolved } = resolveEffectiveScores(scoresResult, decisionsResult)

  const effectiveByExamStudent = new Map<string, EffectiveScore[]>()
  const effectiveQsIds = new Set<string>()
  for (const effectiveScore of resolved) {
    const list = effectiveByExamStudent.get(effectiveScore.examStudentId)
    if (list) list.push(effectiveScore)
    else
      effectiveByExamStudent.set(effectiveScore.examStudentId, [effectiveScore])
    if (effectiveScore.questionScoreId)
      effectiveQsIds.add(effectiveScore.questionScoreId)
  }

  // 印刷対象の注釈のみ（有効スコアとして採用された QuestionScore に紐づくもの）を取得
  const annotationRows = await prisma.drawingAnnotation.findMany({
    where: { questionScore: { cropRegion: { examPage: { examId } } } },
    include: { questionScore: true },
  })

  const annotationsByExamStudent = new Map<string, SnapshotAnnotation[]>()
  for (const annotationRow of annotationRows) {
    if (!effectiveQsIds.has(annotationRow.questionScoreId)) continue // 印刷されない注釈は除外
    const normalized: SnapshotAnnotation = {
      r: annotationRow.questionScore.cropRegionId,
      t: annotationRow.type,
      x: round(annotationRow.x),
      y: round(annotationRow.y),
      ex: round(annotationRow.endX),
      ey: round(annotationRow.endY),
      w: round(annotationRow.width),
      h: round(annotationRow.height),
      c: annotationRow.color,
      sw: round(annotationRow.strokeWidth),
      ls: annotationRow.lineStyle,
      tx: annotationRow.text,
      fs: round(annotationRow.fontSize),
      dx: round(annotationRow.displayX),
      dy: round(annotationRow.displayY),
      ad: annotationRow.anchorDirection,
    }
    const examStudentId = annotationRow.questionScore.examStudentId
    const list = annotationsByExamStudent.get(examStudentId)
    if (list) list.push(normalized)
    else annotationsByExamStudent.set(examStudentId, [normalized])
  }

  return { regions, effectiveByExamStudent, annotationsByExamStudent }
}

/** 1生徒分の正規化済みスナップショット内容を構築する */
const buildContent = (
  effective: EffectiveScore[],
  annotations: SnapshotAnnotation[]
): SnapshotContent => {
  const scores: SnapshotScoreCell[] = effective
    .filter((effectiveScore) => effectiveScore.status !== "unscored")
    .map((effectiveScore) => ({
      r: effectiveScore.cropRegionId,
      s: effectiveScore.status,
      p: effectiveScore.partialScore,
    }))
    .sort((cellA, cellB) =>
      cellA.r < cellB.r ? -1 : cellA.r > cellB.r ? 1 : 0
    )

  // 注釈は id を含めず内容で安定ソート（削除+同内容再作成は「変更なし」とみなす）
  const sortedAnnotations = [...annotations].sort(
    (annotationA, annotationB) => {
      const keyA = JSON.stringify(annotationA)
      const keyB = JSON.stringify(annotationB)
      return keyA < keyB ? -1 : keyA > keyB ? 1 : 0
    }
  )

  return { v: SNAPSHOT_VERSION, scores, annotations: sortedAnnotations }
}

/** 正規化内容を決定的なJSON文字列にする（直接比較用） */
const serializeContent = (content: SnapshotContent): string =>
  JSON.stringify(content)

/** 1生徒分の合計点を計算する */
const computeTotal = (
  effective: EffectiveScore[],
  regions: ExamState["regions"]
): number | null => {
  let total = 0
  let hasAny = false
  for (const effectiveScore of effective) {
    const maxScore = regions.get(effectiveScore.cropRegionId)?.maxScore ?? 0
    const value = calculateEffectiveScoreValue(effectiveScore, maxScore)
    if (value !== null) {
      total += value
      hasAny = true
    }
  }
  return hasAny ? total : null
}

// ---- 公開API ----

/**
 * 指定生徒の現在の有効スコア＋注釈を「返却版」としてスナップショット記録する（upsert）。
 */
export const captureReturnSnapshot = async (options: {
  examId: string
  examStudentIds: string[]
  capturedByUserId?: string | null
}): Promise<CaptureReturnSnapshotResult> => {
  const { examId, examStudentIds, capturedByUserId = null } = options
  const state = await loadExamState(examId)
  const now = new Date()

  // 渡された受験者が本当にこの試験のものかを確かめる。
  // 旧スキーマは @@unique([examId, studentId]) で構造的に保証していたが、
  // examStudentId 単独キーになった今は自分で確かめないと、他の試験の
  // 返却版を空スコアで上書きしうる（08 で試験を切り替えた直後の stale な選択など）。
  const scopedExamStudents = await prisma.examStudent.findMany({
    where: { examId, id: { in: examStudentIds } },
  })
  const scopedExamStudentIds = new Set(
    scopedExamStudents.map((examStudent) => examStudent.id)
  )

  let capturedCount = 0
  for (const examStudentId of examStudentIds) {
    if (!scopedExamStudentIds.has(examStudentId)) continue
    const effective = state.effectiveByExamStudent.get(examStudentId) ?? []
    const annotations = state.annotationsByExamStudent.get(examStudentId) ?? []
    const content = buildContent(effective, annotations)
    const scoresJson = serializeContent(content)
    const total = computeTotal(effective, state.regions)
    const totalScore = total !== null ? new Decimal(total) : null

    await prisma.returnSnapshot.upsert({
      where: { examStudentId },
      create: {
        examStudentId,
        scoresJson,
        totalScore,
        capturedByUserId,
        capturedAt: now,
      },
      update: {
        scoresJson,
        totalScore,
        capturedByUserId,
        capturedAt: now,
      },
    })
    capturedCount++
  }

  // 監査ログ: 返却版として記録（生徒ごとではなく操作単位で1件）
  const scope = await resolveExamScope(examId)
  await recordAuditLog({
    action: "exam.return.capture",
    userId: capturedByUserId,
    entityType: "ReturnSnapshot",
    entityId: examId,
    scopeId: scope.scopeId,
    scopeLabel: scope.scopeLabel,
    summary: `${capturedCount}名の答案を返却版として記録しました`,
    extra: { studentCount: capturedCount },
  })

  return { capturedCount }
}

const toCellState = (
  cell: SnapshotScoreCell | undefined,
  maxScore: number | null
): ReturnScoreCellState | null => {
  if (!cell) return null
  return {
    status: cell.s,
    partialScore: cell.p,
    value: calculateEffectiveScoreValue(
      { status: cell.s, partialScore: cell.p },
      maxScore ?? 0
    ),
  }
}

/**
 * 現在の有効スコア＋注釈と、記録済み返却版スナップショットの差分を返す。
 * 返却版が存在する生徒について、スコア（セル単位 before→after）と注釈の変更有無を判定する。
 */
export const getReturnDiff = async (
  examId: string
): Promise<ReturnDiffResult> => {
  const state = await loadExamState(examId)

  const snapshots = await prisma.returnSnapshot.findMany({
    where: { examStudent: { examId } },
  })
  const snapshotByExamStudent = new Map(
    snapshots.map((snapshot) => [snapshot.examStudentId, snapshot])
  )

  // スナップショットを持つ生徒 ∪ 現在の採点データを持つ生徒
  const examStudentIds = new Set<string>([
    ...snapshotByExamStudent.keys(),
    ...state.effectiveByExamStudent.keys(),
  ])

  const diffs: ReturnStudentDiff[] = []
  for (const examStudentId of examStudentIds) {
    const effective = state.effectiveByExamStudent.get(examStudentId) ?? []
    const annotations = state.annotationsByExamStudent.get(examStudentId) ?? []
    const currentContent = buildContent(effective, annotations)
    const currentTotal = computeTotal(effective, state.regions)

    const snapshot = snapshotByExamStudent.get(examStudentId)
    if (!snapshot) {
      diffs.push({
        examStudentId,
        hasSnapshot: false,
        changed: false,
        capturedAt: null,
        scoreChanges: [],
        annotationChanged: false,
        currentTotal,
        snapshotTotal: null,
      })
      continue
    }

    let snapshotContent: SnapshotContent
    try {
      snapshotContent = JSON.parse(snapshot.scoresJson) as SnapshotContent
    } catch {
      // 壊れたスナップショットは差分不能 → 変更扱いで安全側に倒す
      diffs.push({
        examStudentId,
        hasSnapshot: true,
        changed: true,
        capturedAt: toIso(snapshot.capturedAt),
        scoreChanges: [],
        annotationChanged: false,
        currentTotal,
        snapshotTotal:
          snapshot.totalScore !== null ? Number(snapshot.totalScore) : null,
      })
      continue
    }

    // スコアのセル単位差分
    const beforeScores = new Map(
      snapshotContent.scores.map((cell) => [cell.r, cell])
    )
    const afterScores = new Map(
      currentContent.scores.map((cell) => [cell.r, cell])
    )
    const cellIds = new Set<string>([
      ...beforeScores.keys(),
      ...afterScores.keys(),
    ])
    const scoreChanges: ReturnScoreChange[] = []
    for (const cropRegionId of cellIds) {
      const before = beforeScores.get(cropRegionId)
      const after = afterScores.get(cropRegionId)
      const same =
        before && after && before.s === after.s && before.p === after.p
      if (same) continue
      const maxScore = state.regions.get(cropRegionId)?.maxScore ?? null
      scoreChanges.push({
        cropRegionId,
        label: state.regions.get(cropRegionId)?.label ?? null,
        before: toCellState(before, maxScore),
        after: toCellState(after, maxScore),
      })
    }

    // 注釈差分（内容ベースの直接比較）
    const annotationChanged =
      JSON.stringify(snapshotContent.annotations) !==
      JSON.stringify(currentContent.annotations)

    diffs.push({
      examStudentId,
      hasSnapshot: true,
      changed: scoreChanges.length > 0 || annotationChanged,
      capturedAt: toIso(snapshot.capturedAt),
      scoreChanges,
      annotationChanged,
      currentTotal,
      snapshotTotal:
        snapshot.totalScore !== null ? Number(snapshot.totalScore) : null,
    })
  }

  return { hasAnySnapshot: snapshots.length > 0, diffs }
}

const toIso = (value: Date | string): string =>
  typeof value === "string" ? value : value.toISOString()
