/**
 * 百問繚乱 .hsz ファイルの型定義
 *
 * .hszはZIPアーカイブで、以下を含む:
 * - db_info.json: シート・フィールド定義
 * - correct_N.png: 模範解答画像（ページ番号N）
 * - correct_homography_info_N.json: OpenCV射影変換用特徴点データ（未使用）
 */

// =============================================================================
// db_info.json のルート構造
// =============================================================================

export interface HszDbInfo {
  sheets: HszSheet
  sheet_pages: HszSheetPage[]
  sheet_fields: HszSheetField[]
}

// =============================================================================
// sheets: シート（試験）のメタ情報
// =============================================================================

export interface HszSheet {
  id: number
  /** 教科ID（HSZ_SUBJECT_MAP参照） */
  subject_id: number
  /** ページ数 */
  page_count: number
  /** 配点合計（nullの場合あり） */
  allot: number | null
  /** 試験タイトル（例: "Wプリント 評価プリント 東書 英語1 10回 1年 英語"） */
  title_name: string
  /** フィールド名設定完了フラグ */
  field_names_completed: boolean
  /** 模範解答画像設定完了フラグ */
  corretct_image_completed: boolean // 原文ママ（typo）
  /** フィールド位置設定完了フラグ */
  field_positions_completed: boolean
  /** コース名 */
  course: string
  /** 採点ルール有無 */
  has_saiten_rule: boolean
  created_at: string
  updated_at: string
  /** 学年コード（21=中1等） */
  grade: number
  /** 支社ID */
  branch_id: string
  /** 年度 */
  nendo: number

  // --- 以下は百問繚乱固有の設定（Score at Onceでは未使用） ---
  /** マークサイズ（ピクセル） */
  marking_size: number
  /** 空矩形位置情報 */
  position_config_info: { empry_rects: unknown[] } // 原文ママ（typo）
  meta: Record<string, unknown>
  /** フィールドマージン（ピクセル） */
  field_margin: number
  /** マーク形状（"n"=なし等） */
  mark_shape: string
  /** マーク位置（"center-front"等） */
  marking_position: string
  /** 出席番号OCR桁数（0=使用しない） */
  syusseki_no_ocr_digit: number
  /** 採点回数 */
  saiten_count: number
  src_id: string | null
  position_configed_at: string | null
  /** 同時採点数 */
  douji_saiten_count: number
  /** part3編集モード */
  is_edit_part3: boolean
}

// =============================================================================
// sheet_pages: ページ情報
// =============================================================================

export interface HszSheetPage {
  id: number
  sheet_id: number
  /** 0始まりのページ番号 */
  page: number
  /** 補正位置情報 */
  hosei_position: Record<string, unknown>
  /** 模範解答画像サイズ（w, h ピクセル） */
  correct_image_size: { w: number; h: number }
  /** QRコード情報 */
  qr: unknown | null
  created_at: string
  updated_at: string
}

// =============================================================================
// sheet_fields: フィールド（設問・メタ領域）定義
// =============================================================================

export interface HszSheetField {
  id: number
  sheet_id: number
  /**
   * フィールド種別
   * - "q": 設問（採点対象）
   * - "ssk_no": 出席番号
   * - "name": 氏名
   * - "score": 合計点
   * - "score_r": 観点別合計（region付き）
   * - "score_p": 大問小計
   * - "print_ssk_no": 印刷用出席番号
   * - "print_datetime": 印刷日時
   */
  kind: HszFieldKind
  /** 0始まりのページ番号 */
  page: number
  /** ソート順 */
  sort_no: number
  /** 大問番号（例: "1", "2"） */
  part1: string | null
  /** 中問番号（例: "1", ""） */
  part2: string | null
  /** 小問番号（例: "1", "2"） */
  part3: string | null
  /** 配点 */
  allot: number | null
  /** 観点コード（例: "11", "12"） */
  region: string | null
  /**
   * 領域矩形（ピクセル座標）
   * l=left, t=top, w=width, h=height
   * nullの場合はスキップ対象
   */
  rim: HszFieldRim | null

  // --- 以下は百問繚乱固有の設定（Score at Onceでは未使用） ---
  /** 採点方式（"partial"=部分点あり等） */
  saiten_kind: string | null
  created_at: string
  updated_at: string
  /** マーク位置自動計算 */
  marking_pos_auto: boolean | null
  /** マーク位置オフセット */
  marking_pos: { l: number; t: number } | null
  /** マーク使用フラグ */
  is_mark: boolean
  /** マーク詳細情報 */
  mark_info: Record<string, unknown>
  /** OCR1文字モード */
  is_ocr_one: boolean
  ocr_one_kind: string | null
  m_tangen_id: string | null
  src_id: string | null
  cbt_m_tangen_id: string | null
  /** ランダム出題順 */
  is_random_order: boolean
  /** 完答方式 */
  is_complete_answer: boolean
  /** 正答 */
  correct_answer: string | null
  /** 採点方式詳細 */
  saiten_houshiki: string | null
}

/**
 * フィールドの矩形座標（ピクセル）
 */
export interface HszFieldRim {
  /** left: X座標 */
  l: number
  /** top: Y座標 */
  t: number
  /** width: 幅 */
  w: number
  /** height: 高さ */
  h: number
}

// =============================================================================
// フィールド種別
// =============================================================================

export type HszFieldKind =
  | "q" // 設問（採点対象）
  | "ssk_no" // 出席番号
  | "name" // 氏名
  | "score" // 合計点
  | "score_r" // 観点別合計
  | "score_p" // 大問小計
  | "print_ssk_no" // 印刷用出席番号
  | "print_datetime" // 印刷日時

// =============================================================================
// マッピング定数
// =============================================================================

/**
 * 百問繚乱の subject_id → 教科名マッピング
 *
 * 百問繚乱のsubject_idは以下の値を取る（推定）:
 * 1=国語, 2=数学, 3=理科, 4=英語, 5=社会
 */
export const HSZ_SUBJECT_MAP: Record<number, string> = {
  1: "国語",
  2: "数学",
  3: "理科",
  4: "英語",
  5: "社会",
}

/**
 * Score at OnceのCropRegionタイプへのマッピング
 *
 * 百問繚乱のkind → Score at OnceのCropRegion.type (CropRegionAreaType):
 * - "q" → "QUESTION_ANSWER": 設問（採点対象）
 * - "ssk_no" → "STUDENT_ID": 出席番号
 * - "name" → "STUDENT_NAME": 氏名
 * - "score" → "TOTAL_SCORE": 合計点
 * - "score_r" → "SUBTOTAL_SCORE": 観点別合計
 * - "score_p" → "SUBTOTAL_SCORE": 大問小計
 */
export const HSZ_KIND_TO_CROP_TYPE: Partial<Record<HszFieldKind, string>> = {
  q: "QUESTION_ANSWER",
  ssk_no: "STUDENT_ID",
  name: "STUDENT_NAME",
  score: "TOTAL_SCORE",
  score_r: "SUBTOTAL_SCORE",
  score_p: "SUBTOTAL_SCORE",
}

/**
 * スキップするフィールド種別
 *
 * これらのkindは印刷用メタ情報であり、採点領域として不要
 */
export const HSZ_SKIP_KINDS: Set<HszFieldKind> = new Set([
  "print_ssk_no",
  "print_datetime",
])
