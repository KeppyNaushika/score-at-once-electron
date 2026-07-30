/**
 * 素点行列（対象者 × データソース）
 *
 * 以前は `Map<studentId, Map<dataSourceId, number | null>>` だった。DB に
 * 「その生徒のその成績での行」を表す実体が無く、2つの id を突き合わせるしかなかったためで、
 * 裸の string へ射影した時点で型の守りが外れていた（studentId と dataSourceId は
 * どちらも string なので、取り違えても Map は黙って undefined を返す）。
 *
 * GradeStudent が子を持つようになり実体で引けるようになったので、行はその成績の対象者を、
 * セルは列のデータソースを同梱する（#962 §3.3）。索引は内部に閉じ、公開する API は
 * すべて実体を受け取る。
 */

import type {
  DataSourceInfo,
  GradeStudentForCalc,
} from "./gradeCalculatorTypes"

/**
 * 行の実体に求める最小限の形＝同定できること。
 * 行列と推定は行を「識別して素点を引く」ためにしか使わないので、
 * 実際に何の実体かは呼び出し側（成績算出では GradeStudent）が決める。
 */
export interface RawScoreRowEntity {
  id: string
}

/** 素点行列の1セル。列の実体（データソース）と素点を同梱する */
export interface RawScoreCell {
  dataSource: DataSourceInfo
  /** 推定前の実測素点。未実施・未採点なら null（推定値はここには入らない） */
  rawScore: number | null
}

/** 素点行列の1行。行の主語はその成績の対象者（GradeStudent） */
export interface RawScoreRow<
  TGradeStudent extends RawScoreRowEntity = GradeStudentForCalc,
> {
  gradeStudent: TGradeStudent
  cells: RawScoreCell[]
}

/**
 * 素点行列。行＝対象者、列＝データソース。
 *
 * 推定（absentEstimation）とモデル適合度（computeSourceFit）が共有する読み取り専用の入力で、
 * 構築は gradeCalculator の buildGradeCalcContext が一手に担う（素点組み立ての単一実装）。
 */
export class RawScoreMatrix<
  TGradeStudent extends RawScoreRowEntity = GradeStudentForCalc,
> {
  readonly rows: readonly RawScoreRow<TGradeStudent>[]
  /** 行の id → セル（データソース id 引き）。公開 API は実体しか受け取らない */
  private readonly cellIndex: Map<string, Map<string, RawScoreCell>>

  constructor(rows: RawScoreRow<TGradeStudent>[]) {
    this.rows = rows
    this.cellIndex = new Map(
      rows.map((row) => [
        row.gradeStudent.id,
        new Map(row.cells.map((cell) => [cell.dataSource.id, cell])),
      ])
    )
  }

  /** 指定の行・列のセル。行列に無い組み合わせなら undefined */
  cellOf(
    row: RawScoreRow<TGradeStudent>,
    dataSource: DataSourceInfo
  ): RawScoreCell | undefined {
    return this.cellIndex.get(row.gradeStudent.id)?.get(dataSource.id)
  }

  /** 指定の行・列の素点。セルが無い場合も欠測として null を返す */
  scoreOf(
    row: RawScoreRow<TGradeStudent>,
    dataSource: DataSourceInfo
  ): number | null {
    return this.cellOf(row, dataSource)?.rawScore ?? null
  }

  /**
   * 指定データソースを実測した素点の列（欠測は除く）。
   * @param options.except 除く行（leave-one-out。推定対象の生徒自身を母数から外す用途）
   */
  measuredColumn(
    dataSource: DataSourceInfo,
    options?: { except?: RawScoreRow<TGradeStudent> }
  ): number[] {
    const exceptId = options?.except?.gradeStudent.id
    const scores: number[] = []
    for (const row of this.rows) {
      if (exceptId !== undefined && row.gradeStudent.id === exceptId) continue
      const score = this.scoreOf(row, dataSource)
      if (score !== null) scores.push(score)
    }
    return scores
  }
}
