/**
 * AI 採点のテスト用の土台。試験・設問・答案画像（合成した PNG）・プロンプトを用意し、
 * 偽の事業者をつないだジョブの依存を返す。
 *
 * 答案画像は一時ディレクトリに合成する（実データは使わない）。
 */

import type { PrismaClient } from "@prisma/client"
import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import sharp from "sharp"
import { vi } from "vitest"

import type { AiGradingJobDependencies } from "@/electron-src/lib/aiGrading/jobDependencies"
import { ZERO_USAGE } from "@/electron-src/lib/aiGrading/providers/providerShared"
import type {
  GradingProvider,
  GradingRequest,
  ProviderBatchResult,
  ProviderBatchStatus,
  ProviderGradingResponse,
} from "@/electron-src/lib/aiGrading/providers/types"
import { createAiPrompt } from "@/electron-src/lib/prisma/aiPrompt"

import { createFullTestExam } from "../../helpers/testExamBuilder"

/** 合成する答案画像の大きさ（画素） */
const PAGE_WIDTH = 400
const PAGE_HEIGHT = 560

/** 設問の矩形（用紙比） */
export const TEST_REGION = { x: 0.1, y: 0.1, width: 0.5, height: 0.2 }

/** 解答欄の中に黒い四角（手書きの代わり）を置いた答案画像を作る */
async function writeAnswerImage(absolutePath: string): Promise<void> {
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true })
  const ink = await sharp({
    create: {
      width: 60,
      height: 20,
      channels: 3,
      background: { r: 0, g: 0, b: 0 },
    },
  })
    .png()
    .toBuffer()
  await sharp({
    create: {
      width: PAGE_WIDTH,
      height: PAGE_HEIGHT,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .composite([
      {
        input: ink,
        left: Math.round(PAGE_WIDTH * 0.2),
        top: Math.round(PAGE_HEIGHT * 0.15),
      },
    ])
    .png()
    .toFile(absolutePath)
}

/** 試験1つ（1ページ・1設問・配点5・受験者 studentCount 人）と、答案画像・プロンプト */
export async function createAiGradingFixture(
  testPrisma: PrismaClient,
  options: { studentCount?: number } = {}
) {
  const dataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "ai-grading-"))
  const exam = await createFullTestExam(testPrisma, {
    pageCount: 1,
    cropRegionsPerPage: 1,
    studentCount: options.studentCount ?? 3,
    includeScores: false,
    includeStudentAnswerImages: true,
  })
  const cropRegion = await testPrisma.cropRegion.update({
    where: { id: exam.cropRegions[0].id },
    data: { ...TEST_REGION, points: 5 },
  })
  for (const studentAnswerImage of exam.studentAnswerImages) {
    await writeAnswerImage(
      path.join(dataDirectory, studentAnswerImage.imagePath)
    )
  }
  const prompt = await createAiPrompt(
    {
      cropRegionId: cropRegion.id,
      questionText: "x^2 - 5x + 6 = 0 を解け。",
      modelAnswerText: "x = 2, 3",
      rubricText: "因数分解で2点、解がそろって満点。",
    },
    exam.user.id
  )
  const otherUser = await testPrisma.user.create({
    data: {
      username: `other_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: "別の教員",
      role: "teacher",
    },
  })
  return { exam, cropRegion, prompt, otherUser, dataDirectory }
}

/** 偽の事業者。呼ばれた依頼を記録し、応答は渡した関数が決める */
export function createFakeProvider(options: {
  respond?: (
    request: GradingRequest,
    signal: AbortSignal
  ) => Promise<ProviderGradingResponse>
  batchStatus?: () => ProviderBatchStatus
  batchResults?: () => ProviderBatchResult[]
}) {
  const gradeRequests: GradingRequest[] = []
  const submittedBatches: GradingRequest[][] = []
  const cleanupBatch = vi.fn(async (_externalBatchId: string) => {})
  const cancelBatch = vi.fn(async (_externalBatchId: string) => {})
  const provider: GradingProvider = {
    id: "anthropic",
    capabilities: {
      batch: true,
      promptCache: "explicit",
      structuredOutput: "json_schema",
    },
    async grade(request, signal) {
      gradeRequests.push(request)
      if (!options.respond) throw new Error("respond がありません")
      return options.respond(request, signal)
    },
    async submitBatch(requests) {
      submittedBatches.push(requests)
      return { externalBatchId: "batch_fake_1" }
    },
    async getBatchStatus() {
      return options.batchStatus?.() ?? "in_progress"
    },
    async *readBatchResults() {
      for (const batchResult of options.batchResults?.() ?? []) {
        yield batchResult
      }
    },
    cancelBatch,
    cleanupBatch,
    async testConnection() {},
    async listModels() {
      return []
    },
  }
  return {
    provider,
    gradeRequests,
    submittedBatches,
    cleanupBatch,
    cancelBatch,
  }
}

/** JSON を返して最後まで出力された応答 */
export function completedResponse(json: object): ProviderGradingResponse {
  const rawText = JSON.stringify(json)
  return {
    parsedJson: JSON.parse(rawText),
    rawText,
    usage: { ...ZERO_USAGE, inputTokens: 100, outputTokens: 20 },
    stop: "completed",
    errorMessage: "",
    errorKind: null,
  }
}

/** 検証を通る判定（部分点 3 / 配点 5） */
export const PARTIAL_JUDGEMENT = {
  transcription: "(x-2)(x-3)=0",
  status: "partial",
  partialScore: 3,
  comment: "因数分解は正しいが解が書かれていない",
  annotation: "解を書きましょう",
  confidence: "high",
}

/** 偽の事業者をつないだジョブの依存 */
export function createTestDependencies(
  provider: GradingProvider,
  dataDirectory: string,
  overrides: Partial<AiGradingJobDependencies> = {}
): AiGradingJobDependencies {
  return {
    resolveProvider: () => provider,
    resolveDataPath: (relativePath) => path.join(dataDirectory, relativePath),
    getClientId: () => "client-this-machine",
    getConcurrency: () => 2,
    notifyProgress: vi.fn(),
    ...overrides,
  }
}
