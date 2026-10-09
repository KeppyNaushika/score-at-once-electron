/**
 * AI 採点の事業者（Anthropic / OpenAI / …）を差し替えられるようにするための境界の型。
 *
 * ここに置く型は事業者の SDK に依存しない。各事業者の実装（`anthropicProvider.ts` 等）が
 * この形と SDK の形の間を変換する。設計は docs/vlm-grading-design.md §6。
 */

/** JSON として表せる値（出力スキーマと、事業者が返した JSON の両方に使う） */
export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

/** JSON のオブジェクト */
export interface JsonObject {
  [key: string]: JsonValue
}

/** 対応している事業者。Gemini・OpenAI 互換の接続先は後から足す（設計 §6-3） */
export const GRADING_PROVIDER_IDS = ["anthropic", "openai"] as const
export type GradingProviderId = (typeof GRADING_PROVIDER_IDS)[number]

/** 事業者 id かどうか（ファイルや IPC から来た文字列を確かめる） */
export function isGradingProviderId(
  candidate: unknown
): candidate is GradingProviderId {
  return GRADING_PROVIDER_IDS.some((providerId) => providerId === candidate)
}

/** 推論にかける手間。全事業者に共通する3段だけを使う */
export const GRADING_EFFORTS = ["low", "medium", "high"] as const
export type GradingEffort = (typeof GRADING_EFFORTS)[number]

/** 推論の手間の値かどうか */
export function isGradingEffort(
  candidate: unknown
): candidate is GradingEffort {
  return GRADING_EFFORTS.some((effort) => effort === candidate)
}

/** プロンプトを組む1片 */
export type PromptPart =
  | { kind: "text"; text: string }
  | {
      kind: "image"
      mediaType: "image/png" | "image/jpeg"
      base64Data: string
    }

/**
 * 事業者への依頼1件。1段目は答案1件（1マス）、2段目は設問1つ（画像なし）。
 *
 * `fixedParts` はキャッシュさせる前置き（問題文・模範解答・採点基準・配点など）で、
 * 同じ入力からバイト単位で同じ内容になるように組む（時刻・id・氏名を入れない）。
 * `variableParts` は答案の画像で、必ず `fixedParts` の後ろに置かれる。
 */
export interface GradingRequest {
  /**
   * 依頼の識別子。バッチの結果を依頼へ対応付けるのに使う。
   * 英数字・`_`・`-` の1〜64字（Anthropic の custom_id の制約に揃える）。attempt の uuid を使う
   */
  customId: string
  model: string
  effort: GradingEffort
  maxOutputTokens: number
  systemText: string
  fixedParts: PromptPart[]
  variableParts: PromptPart[]
  /** 出力の JSON スキーマ（全事業者が受け付ける共通の書き方だけを使う。設計 §7-2） */
  outputSchema: JsonObject
  /** 出力の形の名前（英数字と `_`。OpenAI の json_schema の name に使う。段ごとに違う） */
  outputSchemaName: string
}

/**
 * 使用量（トークン数）。単価が違うので、キャッシュの読み書きを別に数える。
 * 3つの入力の欄は重ならない（OpenAI のように内訳で返す事業者は、実装側で引き算して揃える）
 */
export interface ProviderUsage {
  /** キャッシュの読み書きを除いた入力 */
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
}

/** 応答がどう終わったか */
export type ProviderStop = "completed" | "refused" | "max_tokens" | "error"

/**
 * 失敗の種類。jobRunner が「全体を止める（認証）」「待って再試行する（レート制限）」
 * 「再送を提案する（期限切れ）」を分けるのに使う
 */
export type ProviderErrorKind =
  | "authentication"
  | "permission"
  | "rate_limit"
  | "connection"
  | "timeout"
  | "bad_request"
  | "server"
  | "aborted"
  | "expired"
  | "canceled"
  | "invalid_output"
  | "unknown"

/** 事業者の応答を揃えた形 */
export interface ProviderGradingResponse {
  /** 出力を JSON として読めたときの値。読めなければ null（検証は呼び出し側で行う） */
  parsedJson: JsonValue | null
  /** モデルが返した最後のテキスト（JSON の文字列そのもの） */
  rawText: string
  usage: ProviderUsage
  stop: ProviderStop
  /** stop が completed 以外のときの説明。completed なら空文字 */
  errorMessage: string
  /** stop が error のときの失敗の種類。それ以外は null */
  errorKind: ProviderErrorKind | null
}

/** バッチの進み具合 */
export type ProviderBatchStatus =
  /** 処理中（受付・検証・集約中を含む） */
  | "in_progress"
  /** 取り消し中 */
  | "canceling"
  /** 終わった（結果を読める。期限切れ・取り消しで一部が欠けることはある） */
  | "ended"
  /** バッチ全体が受け付けられなかった（結果は無い） */
  | "failed"

/** バッチの結果の1件。届く順は依頼の順と関係ない */
export interface ProviderBatchResult {
  customId: string
  response: ProviderGradingResponse
}

/**
 * 事業者が返したモデルの一覧の1件（事業者に依存しない形）。
 * 分からない項目は null にする（推測で埋めない）
 */
export interface ProviderModelInfo {
  /** API へ送るモデルの id */
  id: string
  /** 人が読む名前。事業者が名前を返さなければ id と同じ */
  displayName: string
  /** 事業者が公開した日時（ISO 8601）。分からなければ null */
  createdAt: string | null
  /**
   * adaptive thinking と effort を送ってよいか。事業者が能力を返さない
   * （OpenAI・Anthropic で capabilities が null）なら null
   */
  supportsAdaptiveThinking: boolean | null
}

/** 事業者ができること */
export interface GradingProviderCapabilities {
  batch: boolean
  promptCache: "explicit" | "automatic" | "none"
  structuredOutput: "json_schema" | "json_object"
}

/**
 * 事業者の SDK へ渡す fetch。学校のプロキシに従わせるため、main から Electron の
 * `net.fetch` を包んで渡す（両 SDK の `fetch` オプションと同じ形）
 */
export type ProviderFetch = (
  input: string | URL | Request,
  init?: RequestInit
) => Promise<Response>

/** 事業者の抽象（設計 §6-1） */
export interface GradingProvider {
  id: GradingProviderId
  capabilities: GradingProviderCapabilities
  /**
   * 1件をその場で採点させる。通信・認証などの失敗は `GradingProviderError` を投げる。
   * 応答は届いたが使えない（拒否・打ち切り・JSON でない）ときは投げずに stop で返す
   */
  grade(
    request: GradingRequest,
    signal: AbortSignal
  ): Promise<ProviderGradingResponse>
  submitBatch(requests: GradingRequest[]): Promise<{ externalBatchId: string }>
  getBatchStatus(externalBatchId: string): Promise<ProviderBatchStatus>
  readBatchResults(externalBatchId: string): AsyncIterable<ProviderBatchResult>
  cancelBatch(externalBatchId: string): Promise<void>
  /**
   * 結果を取り込んだバッチの、事業者側に残る預け物を消す（OpenAI は入力・出力の
   * ファイルを files に残す。答案の画像を含むので、取り込んだら残しておかない）。
   * 預け物を残さない事業者は持たない。失敗は投げる
   */
  cleanupBatch?(externalBatchId: string): Promise<void>
  /** キーと接続先を確かめる（トークンを消費しない呼び出しを使う）。失敗は投げる */
  testConnection(): Promise<void>
  /**
   * そのキーで使えるモデルの一覧（新しい順）。トークンを消費しない。
   * 一覧が複数ページに分かれていれば全ページを読む。失敗は `GradingProviderError` を投げる
   */
  listModels(): Promise<ProviderModelInfo[]>
}
