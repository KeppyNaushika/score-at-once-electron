/**
 * S-P表（Student-Problem chart）と得点度数分布の純粋計算ロジック（#838）
 *
 * 電子側（Excel出力）とフロント側（プレビュー）の双方から利用するため、
 * Node/Electron依存を一切持たない純関数のみで構成する。
 * 入力は最小形（{@link SpInputStudent}）に正規化してから渡す。
 */

// ================== S-P表 ==================

/** 設問1問分の生徒応答（正誤の二値） */
export interface SpInputItem {
  questionId: string
  label: string
  /** 正答なら true */
  isCorrect: boolean
  /** 採点済み（unscored でない）なら true */
  isScored: boolean
}

/** 生徒1人分の入力 */
export interface SpInputStudent {
  studentId: string
  studentName: string
  items: SpInputItem[]
}

/** S-P表の生徒行（合計正答数の降順に並ぶ） */
export interface SpStudentRow {
  studentId: string
  studentName: string
  /** 正答数（行和 n_i） */
  correctCount: number
  /** 生徒の注意係数 CS（判定不可は null） */
  cautionIndex: number | null
  /** 設問列（problems と同順）の正誤 */
  cells: boolean[]
}

/** S-P表の設問列（正答者数の降順に並ぶ） */
export interface SpProblemColumn {
  questionId: string
  label: string
  /** 正答者数（列和 m_j） */
  correctCount: number
  /** 設問の注意係数 CP（判定不可は null） */
  cautionIndex: number | null
}

export interface SpTableResult {
  students: SpStudentRow[]
  problems: SpProblemColumn[]
  /** 母集団となった生徒数 */
  studentCount: number
  /** 設問数 */
  problemCount: number
}

/**
 * S-P表（佐藤の注意係数つき）を計算
 *
 * - 母集団は「採点済みの設問を1問以上持つ生徒」（全問未採点・欠席は除外）。
 * - 注意係数（Sato 1975）:
 *   CS_i = 1 − (実際 − 期待) / (理想 − 期待)
 *     実際 = Σ_j x_ij · m_j（正答した設問の正答者数の総和）
 *     理想 = 正答者数 m を降順に並べた上位 n_i 個の和（Guttman完全パターン）
 *     期待 = n_i · m̄
 *   分母が0（n_i=0、全問正答、全設問の正答者数が同一等）の場合は null。
 *   CP_j も生徒/設問を入れ替えて同様。
 * - 設問数0、または有効生徒0なら null。
 */
export function computeSpTable(input: SpInputStudent[]): SpTableResult | null {
  const students = input.filter((student) =>
    student.items.some((item) => item.isScored)
  )
  if (students.length === 0) return null

  const problemIds = students[0].items.map((item) => item.questionId)
  const problemLabels = students[0].items.map((item) => item.label)
  const m = problemIds.length
  if (m === 0) return null

  const n = students.length

  // 二値行列 x[i][j]（正答=1, それ以外=0）
  const x: number[][] = students.map((student) =>
    problemIds.map((questionId) => {
      const item = student.items.find((item) => item.questionId === questionId)
      return item && item.isCorrect ? 1 : 0
    })
  )

  const rowSum = x.map((row) => row.reduce((a, b) => a + b, 0))
  const colSum = problemIds.map((_, j) => x.reduce((a, row) => a + row[j], 0))

  const colMean = colSum.reduce((a, b) => a + b, 0) / m
  const rowMean = rowSum.reduce((a, b) => a + b, 0) / n
  const colSumDesc = [...colSum].sort((a, b) => b - a)
  const rowSumDesc = [...rowSum].sort((a, b) => b - a)

  const studentCaution = (i: number): number | null => {
    const ni = rowSum[i]
    const actual = x[i].reduce((sum, xij, j) => sum + xij * colSum[j], 0)
    const ideal = colSumDesc.slice(0, ni).reduce((a, b) => a + b, 0)
    const expected = ni * colMean
    const denom = ideal - expected
    if (denom === 0) return null
    return 1 - (actual - expected) / denom
  }

  const problemCaution = (j: number): number | null => {
    const mj = colSum[j]
    const actual = x.reduce((sum, row, i) => sum + row[j] * rowSum[i], 0)
    const ideal = rowSumDesc.slice(0, mj).reduce((a, b) => a + b, 0)
    const expected = mj * rowMean
    const denom = ideal - expected
    if (denom === 0) return null
    return 1 - (actual - expected) / denom
  }

  // 生徒は正答数の降順、設問は正答者数の降順に並べる
  const studentOrder = students
    .map((_, i) => i)
    .sort((a, b) => rowSum[b] - rowSum[a])
  const problemOrder = problemIds
    .map((_, j) => j)
    .sort((a, b) => colSum[b] - colSum[a])

  const problems: SpProblemColumn[] = problemOrder.map((problemIndex) => ({
    questionId: problemIds[problemIndex],
    label: problemLabels[problemIndex],
    correctCount: colSum[problemIndex],
    cautionIndex: problemCaution(problemIndex),
  }))

  const studentRows: SpStudentRow[] = studentOrder.map((i) => ({
    studentId: students[i].studentId,
    studentName: students[i].studentName,
    correctCount: rowSum[i],
    cautionIndex: studentCaution(i),
    cells: problemOrder.map((problemIndex) => x[i][problemIndex] === 1),
  }))

  return {
    students: studentRows,
    problems,
    studentCount: n,
    problemCount: m,
  }
}

// ================== 得点度数分布 ==================

export interface FrequencyBin {
  /** 階級の下限（含む） */
  lower: number
  /** 階級の上限（最終階級以外は含まない） */
  upper: number
  count: number
  label: string
}

export interface FrequencyDistributionResult {
  bins: FrequencyBin[]
  mean: number
  /** 母標準偏差 */
  stdDev: number
  /** 階級の上端（満点） */
  maxScore: number
  /** 集計対象の生徒数 */
  count: number
}

/**
 * 得点度数分布（ヒストグラム階級）を計算
 *
 * - null（未採点・欠席）は除外。
 * - 0〜満点を約10階級に等分（階級幅 = ceil(満点/10), 最小1）。
 * - 平均・標準偏差は母分散（n で割る）。
 */
export function computeFrequencyDistribution(
  totalScores: (number | null)[],
  maxScore: number
): FrequencyDistributionResult | null {
  const scores = totalScores.filter((score): score is number => score !== null)
  if (scores.length === 0) return null

  const top = maxScore > 0 ? maxScore : Math.max(...scores)
  const numBins = 10
  const binWidth = Math.max(1, Math.ceil(top / numBins))

  const bins: FrequencyBin[] = []
  for (let lo = 0; lo < top; lo += binWidth) {
    const hi = lo + binWidth
    bins.push({
      lower: lo,
      upper: hi,
      count: 0,
      label: `${lo}–${Math.min(hi, top)}`,
    })
  }
  // 満点が0、または階級が作られなかった場合の単一階級フォールバック
  if (bins.length === 0) {
    bins.push({ lower: 0, upper: top, count: 0, label: `0–${top}` })
  }

  for (const score of scores) {
    let idx = Math.floor(score / binWidth)
    if (idx >= bins.length) idx = bins.length - 1
    if (idx < 0) idx = 0
    bins[idx].count++
  }

  const mean = scores.reduce((a, b) => a + b, 0) / scores.length
  const variance =
    scores.reduce((a, b) => a + (b - mean) ** 2, 0) / scores.length

  return {
    bins,
    mean,
    stdDev: Math.sqrt(variance),
    maxScore: top,
    count: scores.length,
  }
}
