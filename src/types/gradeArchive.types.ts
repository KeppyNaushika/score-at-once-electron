/**
 * 成績算出アーカイブ(.grade)の型定義
 */

import type {
  CollectedCourseworkData,
  CourseworkImportDecisions,
} from "./courseworkArchive.types"

export interface GradeArchiveManifest {
  version: string
  appVersion: string
  exportedAt: string
  gradeId: string
  gradeName: string
  counts: {
    gradeItems: number
    dataSources: number
    manualScores: number
    boundarySets: number
    boundaries: number
    classrooms: number
    students: number
  }
}

export interface GradeArchiveData {
  manifest: GradeArchiveManifest
  gradeData: ArchiveGradeData
  /**
   * 旧 v1.3.0 以前の外部成績(manual型 DataSource)の点数。
   * v1.4.0 以降は Coursework に昇格したため新規 export では書かない（空配列）。
   * 旧アーカイブ読込時の後方互換フォールバック用に optional で残す。
   */
  manualScoresData?: ArchiveManualScoresData
  /**
   * v1.4.0: 参照中の試験外成績資料（Coursework）の名前ベース埋め込み。
   * 読込後方互換用に残す。v1.5.0 以降は courseworkArchive を使う。
   */
  courseworks?: ArchiveCoursework[]
  /**
   * v1.5.0+: 試験外成績資料を coursework-archive と同じ UUID ベースの形で内包する。
   * 収集・生成ロジックは独立 coursework モジュールへ委譲（二重実装の解消）。
   */
  courseworkArchive?: CollectedCourseworkData
  boundariesData: ArchiveBoundariesData
}

export interface ArchiveGradeData {
  grade: {
    name: string
    description: string | null
    /** 基準日（後方互換: v1.2.0+。古いアーカイブではundefined） */
    referenceDate?: string | null
  }
  /** 成績出力設定（後方互換: v1.2.0+。GradeExportSettingsと1:1） */
  exportSettings?: { settingsJson: string } | null
  gradeItems: ArchiveGradeItem[]
  /**
   * 対象学級。v1.10.0+ は uuid を持ち、照合は uuid 一次・名前二次
   * （exam / coursework アーカイブと同じ方式）。旧アーカイブには id が無い。
   */
  classroomRefs: { id?: string; name: string }[]
  /** 参照する試験。v1.10.0+ は uuid を持ち、照合は uuid 一次・試験名二次 */
  examRefs: {
    id?: string
    examName: string
    examDate: string | null
    dataSourceName: string
  }[]
  /** 対象生徒。v1.10.0+ は uuid を持ち、照合は uuid 一次・学籍番号二次 */
  studentRefs: {
    id?: string
    studentNumber: string
    classroomName: string | null
    customOrder: number | null
  }[]
  /** GradeItem除外設定（後方互換: optional） */
  gradeItemExclusions?: {
    studentNumber: string
    /** v1.10.0+: 参照先評価項目のuuid（照合の一次キー）。旧アーカイブには無い */
    gradeItemId?: string
    /** 参照先評価項目名（uuid不一致時・旧アーカイブのフォールバック） */
    gradeItemName: string
  }[]
  /** 成績ラベル手動上書き（後方互換: optional） */
  gradeOverrides?: {
    studentNumber: string
    /**
     * @deprecated v1.10.0 で総合（overall）を撤去。旧アーカイブにのみ現れる。
     * "overall" の行は transformer が破棄する。
     */
    targetType?: string
    /** v1.10.0+: 対象評価項目のuuid（照合の一次キー）。旧アーカイブには無い */
    gradeItemId?: string
    /** 対象評価項目名。v1.10.0 以降は必ず非null（旧アーカイブでは null = 総合） */
    gradeItemName: string | null
    overrideLabel: string
  }[]
  /**
   * 成績値の確定（凍結）（後方互換: v1.9.0+。古いアーカイブではundefined）。
   * 生徒×評価項目のみ（総合の行は存在しない）。外部参照は他の grade-archive 要素と
   * 揃えて名前ベース（生徒=学籍番号 / 評価項目=項目名）。
   * 確定操作者（frozenByUserId）はアーカイブの移動先に同じ User が居る保証が無いため
   * 持ち出さない（取り込み時は null＝操作者不明になる）。
   */
  gradeFrozenScores?: {
    studentNumber: string
    /** v1.10.0+: 対象評価項目のuuid（照合の一次キー）。旧アーカイブには無い */
    gradeItemId?: string
    /** 対象評価項目名（uuid不一致時・旧アーカイブのフォールバック） */
    gradeItemName: string
    weightedScore: number | null
    weightedMaxScore: number
    percentage: number | null
    gradeLabel: string | null
    frozenAt: string
  }[]
  /** 観点間の制約ルール（後方互換: v1.7.0+。古いアーカイブではundefined） */
  gradeConstraints?: {
    name: string
    kind: string
    config: string
    expression: string
    color: string
    message: string | null
    enabled: boolean
    order: number
  }[]
}

export interface ArchiveGradeItem {
  /**
   * v1.10.0+: export元の評価項目uuid（照合の一次キー）。
   * 評価項目名は unique でなく（GradeItem に (gradeId, name) の制約は無い）教員が
   * 自由に付けられるため、名前だけでは同名の項目を区別できない。旧アーカイブには
   * 無いので optional で、その場合のみ名前フォールバックへ落ちる。
   */
  id?: string
  name: string
  order: number
  dataSources: ArchiveDataSource[]
}

export interface ArchiveDataSource {
  type: string // "exam_total" | "subtotal" | "crop_region" | "coursework" | "coursework_total"（旧: "manual"）
  name: string
  /**
   * @deprecated v1.6.0 で GradeDataSource.maxScore 列が廃止された（満点は元データから
   * computeLiveMaxScore でライブ算出）。v1.6.0+ の export では出力しない。
   *
   * 削除せず optional で残す理由: 旧 1.3.0 アーカイブの "manual" 型データソースでは、
   * この値が CourseworkItem.maxScore（実在する列）の出所になる
   * （V1_3_0_to_V1_4_0 transformer / importer の manual→coursework 変換）。
   * このフィールドを別用途へ転用してはならない（必ずアーカイブ版を切ること）。
   */
  maxScore?: number
  weight: number
  order: number
  examName: string | null
  subtotalName: string | null
  cropRegionLabel: string | null
  absentMethod?: string
  absentRatio?: number
  absentOffset?: number
  treatExpectedAsMissing?: boolean
  estimationMode?: string
  estimationSourceIds?: string[]
  /** v1.4.0+: type==="coursework"（項目参照）/ v1.8.0+: type==="coursework_total"（資料全体）の参照先資料uuid（照合の一次キー） */
  courseworkId?: string | null
  /** v1.4.0+: type==="coursework" の参照先評価項目uuid（照合の一次キー） */
  courseworkItemId?: string | null
  /** v1.4.0+: type==="coursework"（項目参照）/ v1.8.0+: type==="coursework_total"（資料全体）の参照先資料名（uuid不一致時の二次フォールバック） */
  courseworkName?: string | null
  /** v1.4.0+: type==="coursework" の参照先評価項目名（名前フォールバック） */
  courseworkItemName?: string | null
  /** v1.10.0+: 参照先試験のuuid（照合の一次キー）。旧アーカイブには無い */
  examId?: string | null
  /**
   * v1.10.0+: 参照先小計のuuid（照合の一次キー）。旧アーカイブには無い。
   * 小計名は `@@unique([subtotalGroupId, name])` でグループ内でしか一意でなく、
   * 名前だけでは別の試験の同名小計に当たりうる。
   */
  subtotalId?: string | null
  /**
   * v1.10.0+: 参照先採点領域のuuid（照合の一次キー）。旧アーカイブには無い。
   * 領域ラベルは同一試験内でも重複しうる。
   */
  cropRegionId?: string | null
  /**
   * 旧 v1.3.0 の入力モード（"numeric" | "letter"）。読取専用の後方互換用。
   * v1.4.0 以降は CourseworkItem.inputMode が保持する。
   */
  inputMode?: string
  /**
   * 旧 v1.3.0 の文字評価→点数の変換表。読取専用の後方互換用。
   * v1.4.0 以降は CourseworkItem.letterScales が保持する。
   */
  letterScales?: { label: string; score: number; order: number }[]
}

/**
 * v1.4.0+: 試験外成績資料（Coursework）の埋め込みデータ。
 * 点数を失わないため自己完結。外部参照は名前ベース
 * （生徒=学籍番号 / 学級=学級名 / タグ=タグ名）。
 */
export interface ArchiveCoursework {
  /** v1.4.0+: export元の資料uuid（照合の一次キー） */
  id: string
  name: string
  description: string | null
  date: string | null
  classrooms: { classroomName: string; order: number }[]
  tags: { tagName: string }[]
  students: { studentNumber: string; customOrder: number | null }[]
  items: ArchiveCourseworkItem[]
}

export interface ArchiveCourseworkItem {
  /** v1.4.0+: export元の評価項目uuid（照合の一次キー） */
  id: string
  name: string
  order: number
  maxScore: number
  inputMode: string
  letterScales: { label: string; score: number; order: number }[]
  scores: {
    studentNumber: string
    score: number | null
    letterValue: string | null
    adjustment: number | null
    adjustmentReason: string | null
    comment: string | null
  }[]
}

/** インポート実行時のオプション */
export interface GradeArchiveImportOptions {
  /** 試験参照のマッピング（examName → 既存examId） */
  examMapping?: Record<string, string>
  /** 資料ごとの取り込み判断（archiveCourseworkId → 決定）。未指定の資料はuuid一致なら流用、無ければ新規 */
  courseworkDecisions?: CourseworkImportDecisions
}

/** v1.4.0+: 資料1件分のマッチング候補（ウィザードでユーザーに提示） */
export interface GradeArchiveCourseworkMatch {
  /** アーカイブ内の資料uuid（決定マップのキー） */
  archiveId: string
  name: string
  itemCount: number
  studentCount: number
  /** uuid完全一致した既存資料（同一PC由来） */
  uuidMatch: { id: string; name: string } | null
  /** 名前一致した既存資料の候補（名前は非ユニークなので複数あり得る） */
  nameCandidates: { id: string; name: string }[]
}

export interface ArchiveManualScoresData {
  manualScores: {
    gradeItemName: string
    dataSourceName: string
    studentNumber: string
    score: number | null
    /** 文字評価記号（後方互換: v1.3.0+） */
    letterValue?: string | null
    /** 加点・減点（後方互換: v1.3.0+） */
    adjustment?: number | null
    /** 加減点の理由（後方互換: v1.3.0+） */
    adjustmentReason?: string | null
    /** コメント（後方互換: v1.3.0+） */
    comment?: string | null
  }[]
}

export interface ArchiveBoundariesData {
  boundarySets: {
    /**
     * @deprecated v1.10.0 で総合（overall）を撤去。旧アーカイブにのみ現れる。
     * "overall" のセットは transformer が破棄する。
     */
    targetType?: string
    /** v1.10.0+: 対象評価項目のuuid（照合の一次キー）。旧アーカイブには無い */
    gradeItemId?: string
    /** 対象評価項目名。v1.10.0 以降は必ず非null（旧アーカイブでは null = 総合） */
    gradeItemName: string | null
    boundaries: {
      label: string
      minPercentage: number
      order: number
    }[]
  }[]
}

export interface GradeArchiveImportPreview {
  manifest: GradeArchiveManifest
  classroomMatches: { found: boolean; name: string }[]
  examMatches: {
    examName: string
    found: boolean
    examId: string | null
  }[]
  studentMatchCount: number
  studentMissingCount: number
  /** v1.4.0+: 埋め込み資料ごとのマッチング候補（ユーザー判断用） */
  courseworkMatches: GradeArchiveCourseworkMatch[]
  /**
   * 旧バージョンからの変換で失われるデータの警告（取り込み前に見せる）。
   * 例: v1.10.0 で撤去された総合の境界セット・上書きの破棄。
   * 取り込み後のトーストだけでは「確定してから知る」ことになるため preview にも載せる。
   */
  warnings: string[]
}

// =============================================================================
// バージョントランスフォーマー
// =============================================================================

/**
 * トランスフォーマーが扱うバージョン。
 * - 1.3.0: 外部成績は manual-scores.json（manual型 DataSource）
 * - 1.4.0: courseworks.json に名前ベースで埋め込み
 * - 1.5.0: courseworks.json を coursework-archive 形式（UUIDベース）で内包
 * - 1.6.0: GradeDataSource.maxScore 列を廃止（満点はライブ算出）。外部成績の構造は
 *   1.5.0 と同形のため専用 transformer は無し（ArchiveDataSource.maxScore は optional で旧読込互換）。
 * - 1.7.0: 観点間の制約ルール（GradeConstraint）を追加。gradeConstraints は optional で
 *   旧アーカイブ読込時は空配列扱い。構造は加算的なため専用 transformer は無し。
 * - 1.8.0: 資料全体を参照する coursework_total 型 DataSource を追加。参照先資料は
 *   既存の ArchiveDataSource.courseworkId / courseworkName（optional）で表現するため
 *   新規フィールドは無く、旧アーカイブには coursework_total が存在しないだけなので
 *   専用 transformer は無し（加算的変更）。
 * - 1.9.0: 成績値の確定（GradeFrozenScore）を追加。gradeFrozenScores は optional で
 *   旧アーカイブ読込時は「確定なし」扱い。構造は加算的なため専用 transformer は無し。
 * - 1.10.0: 総合（overall）を撤去。境界セット・手動上書きの targetType を廃し、対象は
 *   必ず評価項目になった。旧アーカイブの総合エントリは破棄されるため、加算的変更ではなく
 *   専用 transformer（V1_9_0_to_V1_10_0）を持つ。
 *   併せて外部参照（評価項目・生徒・学級・試験・小計・採点領域）の照合を
 *   uuid 一次・名前二次へ（exam / coursework アーカイブと同じ方式）。
 *   これらの名前・ラベルはいずれも同定に足りず、名前だけでは取り違える。
 *
 * 検出は manifest.version 文字列ではなくデータ形状で行う（旧アーカイブのバージョン
 * 表記が不正確でも確実に正規化するため。詳細は grade-transformers/index.ts）。
 */
export type GradeArchiveVersion =
  "1.3.0" | "1.4.0" | "1.5.0" | "1.6.0" | "1.7.0" | "1.8.0" | "1.9.0" | "1.10.0"
export const GRADE_CURRENT_VERSION: GradeArchiveVersion = "1.10.0"

export interface GradeTransformResult {
  data: GradeArchiveData
  warnings: string[]
}

export interface GradeVersionTransformer {
  readonly fromVersion: GradeArchiveVersion
  readonly toVersion: GradeArchiveVersion
  transform(data: GradeArchiveData): GradeTransformResult
}

export interface GradeChainTransformResult {
  data: GradeArchiveData
  originalVersion: GradeArchiveVersion
  finalVersion: GradeArchiveVersion
  appliedTransformations: {
    from: GradeArchiveVersion
    to: GradeArchiveVersion
  }[]
  warnings: string[]
}
