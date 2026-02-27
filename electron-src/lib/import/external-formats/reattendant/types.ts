/**
 * リアテンダント .dat ファイルの型定義
 *
 * .datはZIPアーカイブで、以下を含む:
 * - 1/RealtendantAppVersion.txt: バージョン情報（検出用）
 * - 1/contents.json: コンテンツ情報（image_scale等）
 * - 1/workbooks.json: テスト情報（名前、教科、満点）
 * - 1/questions.json: 設問定義（question_name, score_allocation）
 * - 1/angles.json: 観点（知識・技能, 思考・判断・表現）
 * - 1/question_angles.json: 設問→観点紐付け
 * - 1/{uid}@{ver}/1/Correct/abc_m*.png: 模範解答画像（フルスケール）
 * - 1/{uid}@{ver}/1(html)/{wid}/json/{wid}.js: 座標データ (var abcData={...})
 */

// =============================================================================
// contents.json
// =============================================================================

export interface DatContents {
  id: number
  contents_uid: string
  contents_name: string
  version: string
  /** 座標スケール（通常 0.5） */
  image_scale: number
}

// =============================================================================
// workbooks.json
// =============================================================================

export interface DatWorkbook {
  id: number
  workbook_uid: string
  workbook_name: string
  workbook_display_name: string
  /** 教科ID */
  subject_id: number
  /** 満点 */
  full_score: number
  /** 設問数 */
  question_count: number
  contents_id: number
}

// =============================================================================
// questions.json
// =============================================================================

export interface DatQuestion {
  id: number
  no: number
  question_seq: number
  question_name: string
  /**
   * 設問タイプ
   * 2 = 通常（FREE相当）
   */
  question_type: number
  score_allocation: number
  workbook_id: number
}

// =============================================================================
// angles.json
// =============================================================================

export interface DatAngle {
  id: number
  angle_name: string
  angle_short_name: string
  subject_id: number
  angle_sort_no: number
  delete_flg: boolean
}

// =============================================================================
// question_angles.json
// =============================================================================

export interface DatQuestionAngle {
  question_id: number
  angle_id: number
}

// =============================================================================
// abcData (座標データ .js ファイル)
// =============================================================================

export interface DatAbcData {
  PageBlock: DatPageBlock[]
  PageMax: number
  QuizUID: string
  TestName: string
}

export interface DatPageBlock {
  AreaBlock: DatAreaBlock[]
  PageNo: number
  QuationBlock: DatQuationBlock[]
  /** ページ画像ファイル名（json/フォルダ内） */
  QuizImage: string
}

export interface DatAreaBlock {
  Height: number
  /** "AREA_NO" = 出席番号, "AREA_NAME" = 氏名 */
  Type: string
  Width: number
  X: number
  Y: number
}

export interface DatQuationBlock {
  No: number
  /** 設問タイプ: "FREE" | "PARTIAL_MATCH" 等 */
  QuizType: string
  QuizName: string
  Score: number
  /** ソート順（全ページ通し） */
  Seq: number
  /** FREE設問の場合: 1つのPointArea */
  PointArea: DatPointArea[]
  /** PARTIAL_MATCH設問の場合: 個別の完答部分 */
  Completion: DatCompletion[] | null
}

export interface DatPointArea {
  Height: number
  Type: string
  Width: number
  X: number
  Y: number
}

export interface DatCompletion {
  PointArea: DatPointArea[]
}

// =============================================================================
// マッピング定数
// =============================================================================

/**
 * AreaBlockのType → Score at OnceのCropRegion.type マッピング
 */
export const DAT_AREA_TYPE_TO_CROP_TYPE: Record<string, string> = {
  AREA_NO: "STUDENT_ID",
  AREA_NAME: "STUDENT_NAME",
}

/**
 * AreaBlockのType → ラベル マッピング
 */
export const DAT_AREA_TYPE_TO_LABEL: Record<string, string> = {
  AREA_NO: "出席番号",
  AREA_NAME: "氏名",
}

/**
 * リアテンダントの subject_id → 教科名マッピング（推定）
 */
export const DAT_SUBJECT_MAP: Record<number, string> = {
  11: "国語",
  12: "数学",
  13: "理科",
  14: "社会",
  15: "音楽",
  16: "美術",
  17: "保健体育",
  18: "英語",
  19: "技術・家庭",
}
