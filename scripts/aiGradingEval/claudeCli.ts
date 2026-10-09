/**
 * Claude Code の CLI（`claude -p`）に1件の依頼を送り、構造化出力を受け取る。
 *
 * 入力は stream-json の user メッセージ1行（text と image の block）。画像は base64 の
 * image block でそのまま通る。出力は stream-json で、最後の `result` イベントの
 * `structured_output` に JSON が、`usage`・`total_cost_usd`（定価換算の目安）が入る。
 *
 * 道具は渡さず（`--tools ""`）、設定・MCP・セッションの保存を読まない。`--bare` は
 * API キー専用なので使わない（サブスクリプションの認証で走らせるため）。
 */

import { spawn } from "child_process"

import type {
  JsonObject,
  PromptPart,
} from "../../electron-src/lib/aiGrading/providers/types"

export interface ClaudeCliRequest {
  model: string
  effort: string
  systemText: string
  parts: readonly PromptPart[]
  schema: JsonObject
  timeoutMs: number
  /** CLI を走らせる作業ディレクトリ（リポジトリの外） */
  workDir: string
}

export interface ClaudeCliUsage {
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  thinkingTokens: number
}

export interface ClaudeCliResult {
  /** CLI が成功を返し、構造化出力があった */
  ok: boolean
  structuredOutput: unknown
  usage: ClaudeCliUsage
  costUsd: number
  /** 起動から終了までの実時間 */
  wallMs: number
  /** CLI が報告した API の時間 */
  apiMs: number
  numTurns: number
  /** 失敗のときの説明（終了コード・result の subtype・標準エラーの末尾） */
  errorText: string
  /** 最後に見えた5時間枠・7日枠の使用率（0〜1） */
  rateLimitUtilization: { fiveHour: number | null; sevenDay: number | null }
}

const EMPTY_USAGE: ClaudeCliUsage = {
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  thinkingTokens: 0,
}

/** PromptPart の並びを、stream-json の user メッセージ1行にする */
export function toStreamJsonUserLine(parts: readonly PromptPart[]): string {
  const content = parts.map((part) =>
    part.kind === "text"
      ? { type: "text", text: part.text }
      : {
          type: "image",
          source: {
            type: "base64",
            media_type: part.mediaType,
            data: part.base64Data,
          },
        }
  )
  return `${JSON.stringify({ type: "user", message: { role: "user", content } })}\n`
}

const isObject = (candidate: unknown): candidate is Record<string, unknown> =>
  typeof candidate === "object" &&
  candidate !== null &&
  !Array.isArray(candidate)

const numberAt = (record: Record<string, unknown>, key: string): number => {
  const field = record[key]
  return typeof field === "number" ? field : 0
}

function readUsage(usage: unknown): ClaudeCliUsage {
  if (!isObject(usage)) return EMPTY_USAGE
  const details = usage.output_tokens_details
  return {
    inputTokens: numberAt(usage, "input_tokens"),
    outputTokens: numberAt(usage, "output_tokens"),
    cacheReadTokens: numberAt(usage, "cache_read_input_tokens"),
    cacheWriteTokens: numberAt(usage, "cache_creation_input_tokens"),
    thinkingTokens: isObject(details)
      ? numberAt(details, "thinking_tokens")
      : 0,
  }
}

function readUtilization(event: Record<string, unknown>, windowName: string) {
  const info = event.rate_limit_info
  if (!isObject(info) || !isObject(info.unifiedWindows)) return null
  const window = info.unifiedWindows[windowName]
  return isObject(window) && typeof window.utilization === "number"
    ? window.utilization
    : null
}

/** stream-json の出力（行の並び）を読み、結果にまとめる */
export function parseStreamJsonOutput(
  stdout: string
): Omit<ClaudeCliResult, "wallMs"> {
  const events = stdout
    .split("\n")
    .filter((line) => line.trim().startsWith("{"))
    .flatMap((line) => {
      try {
        const parsed: unknown = JSON.parse(line)
        return isObject(parsed) ? [parsed] : []
      } catch {
        return []
      }
    })
  const rateLimitEvents = events.filter(
    (event) => event.type === "rate_limit_event"
  )
  const lastRateLimit = rateLimitEvents[rateLimitEvents.length - 1]
  const rateLimitUtilization = {
    fiveHour: lastRateLimit
      ? readUtilization(lastRateLimit, "five_hour")
      : null,
    sevenDay: lastRateLimit
      ? readUtilization(lastRateLimit, "seven_day")
      : null,
  }
  const resultEvent = events.filter((event) => event.type === "result").pop()
  if (!resultEvent) {
    return {
      ok: false,
      structuredOutput: null,
      usage: EMPTY_USAGE,
      costUsd: 0,
      apiMs: 0,
      numTurns: 0,
      errorText: "result イベントがありません",
      rateLimitUtilization,
    }
  }
  const structuredOutput = resultEvent.structured_output ?? null
  const isError = resultEvent.is_error === true || structuredOutput === null
  return {
    ok: !isError,
    structuredOutput,
    usage: readUsage(resultEvent.usage),
    costUsd: numberAt(resultEvent, "total_cost_usd"),
    apiMs: numberAt(resultEvent, "duration_api_ms"),
    numTurns: numberAt(resultEvent, "num_turns"),
    errorText: isError
      ? `subtype=${String(resultEvent.subtype)} result=${String(resultEvent.result).slice(0, 300)}`
      : "",
    rateLimitUtilization,
  }
}

/** 1件を CLI で走らせる。時間切れは強制終了して失敗として返す */
export function runClaudeCli(
  request: ClaudeCliRequest
): Promise<ClaudeCliResult> {
  const args = [
    "-p",
    "--input-format",
    "stream-json",
    "--output-format",
    "stream-json",
    "--verbose",
    "--system-prompt",
    request.systemText,
    "--tools",
    "",
    "--no-session-persistence",
    "--setting-sources",
    "",
    "--strict-mcp-config",
    "--model",
    request.model,
    "--effort",
    request.effort,
    "--json-schema",
    JSON.stringify(request.schema),
  ]
  const startedAt = Date.now()
  return new Promise((resolve) => {
    const child = spawn("claude", args, { cwd: request.workDir })
    let stdout = ""
    let stderr = ""
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      child.kill("SIGKILL")
    }, request.timeoutMs)
    child.stdout.on("data", (chunk: Buffer) => (stdout += chunk.toString()))
    child.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString()))
    child.on("close", (exitCode) => {
      clearTimeout(timer)
      const parsed = parseStreamJsonOutput(stdout)
      const wallMs = Date.now() - startedAt
      if (timedOut || exitCode !== 0) {
        resolve({
          ...parsed,
          ok: false,
          wallMs,
          errorText: [
            timedOut
              ? `時間切れ（${request.timeoutMs}ms）`
              : `終了コード ${exitCode}`,
            parsed.errorText,
            stderr.trim().slice(-300),
          ]
            .filter((text) => text !== "")
            .join(" / "),
        })
        return
      }
      resolve({ ...parsed, wallMs })
    })
    child.stdin.end(toStreamJsonUserLine(request.parts))
  })
}
