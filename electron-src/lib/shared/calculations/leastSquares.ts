/**
 * 最小二乗法（OLS 重回帰）の数値計算。
 *
 * 欠測推定の重回帰法と、データソースのモデル適合度 R が共有する。
 * 多重共線性で従属になった列はランク落ちで除外してから正規方程式を解く。
 */

/**
 * 設計行列 X の列から線形独立な列を選ぶ（変形グラム・シュミット）。
 * 既に採用した列が張る空間への直交残差ノルムが元のノルムに対して極小な列は、
 * 従属列とみなして落とす。列0（切片）から入力順に処理する。
 * @returns 採用した列インデックスの配列（入力順、切片列0を含む）
 */
export function selectIndependentColumns(
  X: number[][],
  p: number,
  relativeTolerance = 1e-8
): number[] {
  const n = X.length
  const retainedColumns: number[] = []
  const orthonormalBasis: number[][] = []

  for (let column = 0; column < p; column++) {
    const vector = X.map((row) => row[column])
    const originalNorm = Math.sqrt(
      vector.reduce((sum, value) => sum + value * value, 0)
    )
    if (originalNorm < 1e-12) continue // ゼロ列は落とす

    // 既存の正規直交基底に対して直交化した残差を求める
    const residual = vector.slice()
    for (const basisVector of orthonormalBasis) {
      let dot = 0
      for (let i = 0; i < n; i++) dot += residual[i] * basisVector[i]
      for (let i = 0; i < n; i++) residual[i] -= dot * basisVector[i]
    }
    const residualNorm = Math.sqrt(
      residual.reduce((sum, value) => sum + value * value, 0)
    )
    if (residualNorm / originalNorm < relativeTolerance) continue // 従属列 → 除外

    for (let i = 0; i < n; i++) residual[i] /= residualNorm
    orthonormalBasis.push(residual)
    retainedColumns.push(column)
  }
  return retainedColumns
}

/**
 * 指定した列サブセットだけで正規方程式 (Xr^T Xr) β = Xr^T Y を組み、ガウス消去で解く。
 * columns で選んだ独立列のみを使うため、この部分系は正則（解ければ非null）。
 */
export function solveNormalEquations(
  X: number[][],
  Y: number[],
  columns: number[]
): number[] | null {
  const n = X.length
  const r = columns.length

  const XtX: number[][] = Array.from({ length: r }, () => Array(r).fill(0))
  for (let i = 0; i < r; i++) {
    for (let j = 0; j < r; j++) {
      let sum = 0
      for (let k = 0; k < n; k++) {
        sum += X[k][columns[i]] * X[k][columns[j]]
      }
      XtX[i][j] = sum
    }
  }

  const XtY: number[] = Array(r).fill(0)
  for (let i = 0; i < r; i++) {
    let sum = 0
    for (let k = 0; k < n; k++) {
      sum += X[k][columns[i]] * Y[k]
    }
    XtY[i] = sum
  }

  return gaussianEliminationSolve(XtX, XtY, r)
}

/**
 * 連立一次方程式 A β = b をガウス消去法（部分ピボット選択）で解く。
 * ピボットが極小（特異）なら null を返す。
 */
function gaussianEliminationSolve(
  A: number[][],
  b: number[],
  m: number
): number[] | null {
  const aug: number[][] = A.map((row, i) => [...row, b[i]])

  for (let col = 0; col < m; col++) {
    // ピボット選択
    let maxRow = col
    let maxVal = Math.abs(aug[col][col])
    for (let row = col + 1; row < m; row++) {
      if (Math.abs(aug[row][col]) > maxVal) {
        maxVal = Math.abs(aug[row][col])
        maxRow = row
      }
    }
    if (maxVal < 1e-12) return null // 特異

    // 行交換
    if (maxRow !== col) {
      ;[aug[col], aug[maxRow]] = [aug[maxRow], aug[col]]
    }

    // 前進消去
    const pivot = aug[col][col]
    for (let row = col + 1; row < m; row++) {
      const factor = aug[row][col] / pivot
      for (let j = col; j <= m; j++) {
        aug[row][j] -= factor * aug[col][j]
      }
    }
  }

  // 後退代入
  const solution = Array(m).fill(0)
  for (let i = m - 1; i >= 0; i--) {
    if (Math.abs(aug[i][i]) < 1e-12) return null
    let sum = aug[i][m]
    for (let j = i + 1; j < m; j++) {
      sum -= aug[i][j] * solution[j]
    }
    solution[i] = sum / aug[i][i]
  }

  return solution
}

/**
 * 当てはまりの重相関 R（0〜1）を自由度補正済みで返す。訓練データの実測 vs 予測から
 * 調整済み決定係数 adjR² = 1 − (1−R²)(n−1)/(n−k−1) を出し R=√max(0, adjR²) とする。
 * 素の R²（=1−SS_res/SS_tot）は説明変数 k が多く標本 n が小さいほど1へ膨らむため、
 * 残差自由度 n−k−1 で補正して過大評価を抑える。予測は「実力の R 倍」まで広がる縮小率。
 * @param X 設計行列（各行 [1, x1, …]、切片列含む）
 * @param Y 実測値
 * @param beta 係数（全長 p、従属列は0）
 * @param predictorCount 独立な説明変数の数（切片を除く採用列数 = 採用列数−1）
 * @returns 補正済み R、または算出不能（分散ゼロ / 残差自由度なし）時 undefined
 */
export function multipleCorrelationR(
  X: number[][],
  Y: number[],
  beta: number[],
  predictorCount: number
): number | undefined {
  const n = X.length
  const p = beta.length
  const meanY = Y.reduce((sum, y) => sum + y, 0) / n
  let ssRes = 0
  let ssTot = 0
  for (let k = 0; k < n; k++) {
    let fitted = 0
    for (let j = 0; j < p; j++) fitted += beta[j] * X[k][j]
    ssRes += (Y[k] - fitted) ** 2
    ssTot += (Y[k] - meanY) ** 2
  }
  if (ssTot <= 0) return undefined
  const dfResidual = n - predictorCount - 1
  if (dfResidual <= 0) return undefined // 残差自由度なし＝R²は必ず1（無意味）
  const r2 = 1 - ssRes / ssTot
  const adjustedR2 = 1 - ((1 - r2) * (n - 1)) / dfResidual
  return Math.sqrt(Math.max(0, adjustedR2))
}
