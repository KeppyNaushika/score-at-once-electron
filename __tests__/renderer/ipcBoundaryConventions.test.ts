/**
 * IPC 境界の規約をソースの走査で守る。
 *
 * 型検査が見てくれる部分と、見てくれない部分がある。
 *
 * - `invoke<Channel extends keyof Handlers>` のおかげで、**登録の無いチャンネルを
 *   呼ぶ**のはコンパイルエラーになる。ここでの検査は綴りを一覧で見せるためのもの
 * - 逆向き（**登録したまま誰も呼ばないチャンネル**）は型では止まらない。放っておくと
 *   到達不能なハンドラが残る（実例は docs/type-assertion-audit.md §13）
 * - `src/` から `electron-src/` への**値** import も型では止まらない。値で引くと
 *   renderer のバンドルへ main の依存グラフ（Prisma・ネイティブモジュール）が
 *   入り込む
 *
 * Decimal の走査は置かない。境界（`registerChannel`）が戻り値へ一律に
 * `serializePrisma` を掛け、preload の `invoke` が型に `Serialized<>` を掛けるので、
 * ハンドラ個別の書き忘れという状態が作れない。
 */

import { execSync } from "child_process"
import * as fs from "fs"
import * as path from "path"
import ts from "typescript"
import { describe, expect, it } from "vitest"

const REPO_ROOT = path.resolve(__dirname, "../..")

/**
 * `src/` が値として引いてよい main のモジュールと名前。
 *
 * ここは「純粋計算なら良い」といった判断基準ではなく**名指しの一覧**である。
 * 増やすときは OWNER の判断を通す。いずれも DB もファイルも触らない計算で、
 * main と renderer が同じ結果を出す必要があるもの。
 */
const ALLOWED_VALUE_IMPORTS: Record<string, string[]> = {
  "@/electron-src/lib/shared/utilities/examPaperSize": ["resolveExamPaperSize"],
  "@/electron-src/lib/export/individual-report/types": [
    "STATISTIC_KINDS",
    "STATISTIC_SCOPES",
    "DEFAULT_INDIVIDUAL_REPORT_OPTIONS",
  ],
  "@/electron-src/lib/shared/calculations/numericStats": [
    "calculateAverage",
    "calculateBoxPlot",
    "calculateRank",
    "calculateStandardDeviation",
  ],
  "@/electron-src/lib/shared/calculations/itemAnalysis": [
    "computeItemAnalysis",
  ],
  "@/electron-src/lib/shared/calculations/spAnalysis": [
    "computeFrequencyDistribution",
    "computeSpTable",
  ],
  "@/electron-src/lib/shared/calculations/gradeDataSourceMaxScore": [
    "computeMaxScoreFromPayload",
  ],
}

/**
 * 追跡されているファイルを列挙する。
 *
 * `git ls-files` は**消したがまだ index に残っているファイルも返す**ので、
 * 実在するものだけに絞る（絞らないと、ファイルを消した瞬間にこの検査が
 * 「読み込めない」で落ちる）。
 */
function listFiles(pattern: string): string[] {
  return execSync(
    `git ls-files --cached --others --exclude-standard ${pattern}`,
    {
      cwd: REPO_ROOT,
      encoding: "utf8",
    }
  )
    .trim()
    .split("\n")
    .filter(Boolean)
    .filter((relativePath) => fs.existsSync(path.join(REPO_ROOT, relativePath)))
}

function parseFile(relativePath: string, kind: ts.ScriptKind): ts.SourceFile {
  const fullPath = path.join(REPO_ROOT, relativePath)
  return ts.createSourceFile(
    fullPath,
    fs.readFileSync(fullPath, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    kind
  )
}

/** 登録簿に載っているチャンネル名 → 定義しているファイル */
function collectRegisteredChannels(): Map<string, string> {
  const registered = new Map<string, string>()

  for (const relativePath of listFiles(
    "'electron-src/ipc-handlers/*Handlers.ts'"
  )) {
    const source = parseFile(relativePath, ts.ScriptKind.TS)
    const visit = (node: ts.Node) => {
      if (
        ts.isVariableDeclaration(node) &&
        node.initializer &&
        node.name.getText().endsWith("Handlers")
      ) {
        // `satisfies HandlerMap` / `as const` を剥がす
        let initializer: ts.Node = node.initializer
        while (
          ts.isSatisfiesExpression(initializer) ||
          ts.isAsExpression(initializer)
        ) {
          initializer = initializer.expression
        }
        if (ts.isObjectLiteralExpression(initializer)) {
          for (const property of initializer.properties) {
            const name = property.name
            if (!name) continue
            if (ts.isStringLiteral(name) || ts.isIdentifier(name)) {
              registered.set(name.text, relativePath)
            }
          }
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(source)
  }

  return registered
}

/** preload が `bind("…")` / `invoke("…")` で呼んでいるチャンネル名 */
function collectInvokedChannels(): Set<string> {
  const invoked = new Set<string>()

  for (const relativePath of listFiles("'electron-src/preload-apis/*.ts'")) {
    const source = parseFile(relativePath, ts.ScriptKind.TS)
    const visit = (node: ts.Node) => {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        (node.expression.text === "bind" ||
          node.expression.text === "invoke") &&
        node.arguments.length > 0 &&
        ts.isStringLiteral(node.arguments[0])
      ) {
        invoked.add(node.arguments[0].text)
      }
      ts.forEachChild(node, visit)
    }
    visit(source)
  }

  return invoked
}

/** `src/` から `electron-src/` を値として引いている箇所 */
function collectValueImports(): string[] {
  const found: string[] = []

  for (const relativePath of listFiles("'src/**/*.ts' 'src/**/*.tsx'")) {
    const source = parseFile(relativePath, ts.ScriptKind.TSX)
    for (const statement of source.statements) {
      if (!ts.isImportDeclaration(statement)) continue
      if (!ts.isStringLiteral(statement.moduleSpecifier)) continue
      const specifier = statement.moduleSpecifier.text
      if (!specifier.startsWith("@/electron-src/")) continue

      const clause = statement.importClause
      if (!clause || clause.isTypeOnly) continue

      const { line } = source.getLineAndCharacterOfPosition(
        statement.getStart()
      )
      const location = `${relativePath}:${line + 1}`
      const allowed = ALLOWED_VALUE_IMPORTS[specifier] ?? []

      const bindings = clause.namedBindings
      if (bindings && ts.isNamedImports(bindings)) {
        for (const element of bindings.elements) {
          if (element.isTypeOnly) continue
          const imported = element.propertyName?.text ?? element.name.text
          if (!allowed.includes(imported)) {
            found.push(`${location}: ${imported} from ${specifier}`)
          }
        }
      } else {
        // default / namespace import は一覧で表せないので常に違反
        found.push(`${location}: default or namespace from ${specifier}`)
      }
    }
  }

  return found
}

/**
 * まだ `src/queries/` へ移していないファイル。**増やさないこと。**
 *
 * DB へのアクセスは `src/queries/` の `queryOptions` / `defineMutation` に集める。
 * キーと呼び出しが1箇所で結びつくので、同じデータが別のキーで2度キャッシュされる
 * 事故（段階7・段階9 で実際に起きた）が構造的に起きなくなる。
 *
 * ここは移行の残量そのもので、**減る一方**になる。新しいファイルが載ることは無い。
 */
const NOT_YET_MIGRATED = [
  "src/app/(app)/answer-sheet-builder/[definitionId]/layout.tsx",
  "src/app/(app)/classrooms/[classroomId]/hooks/useClassroomExamResults.ts",
  "src/app/(app)/exams/[examId]/01-upload/page.tsx",
  "src/app/(app)/exams/[examId]/03-region-info/page.tsx",
  "src/app/(app)/exams/[examId]/04-question-group/page.tsx",
  "src/app/(app)/exams/[examId]/06-student-answers/hooks/index.tsx",
  "src/app/(app)/exams/[examId]/layout.tsx",
  "src/app/(app)/exams/[examId]/page.tsx",
  "src/app/(app)/settings/components/AuditLogsTab.tsx",
  "src/app/(app)/settings/components/ScreenControlTab.tsx",
  "src/app/(app)/settings/hooks/useAuditLogs.ts",
  "src/app/(app)/settings/hooks/useKeyboardSettings.ts",
  "src/app/(app)/settings/hooks/useSyncSettings.ts",
  "src/app/(app)/settings/page.tsx",
  "src/app/(app)/students/[studentId]/hooks/useStudentDetail.ts",
  "src/app/(app)/students/[studentId]/hooks/useStudentExamResults.ts",
  "src/app/login/PasscodeModal.tsx",
  "src/app/login/UserCreateModal.tsx",
  "src/app/login/page.tsx",
  "src/components/answer-sheet-builder/AnswerSheetBuilderMainView.tsx",
  "src/components/answer-sheet-builder/AnswerSheetDefinitionDetail.tsx",
  "src/components/answer-sheet-builder/AnswerSheetDefinitionList.tsx",
  "src/components/answer-sheet-builder/AnswerSheetExportView.tsx",
  "src/components/answer-sheet-builder/components/form/ImageElementEditor.tsx",
  "src/components/answer-sheet-builder/hooks/useAnswerSheetDefinitions.ts",
  "src/components/answer-sheet-builder/hooks/useAnswerSheetExport.ts",
  "src/components/answer-sheet-builder/hooks/useAsbOwner.ts",
  "src/components/answer-sheet-builder/hooks/useExamIntegration.ts",
  "src/components/answer-sheet-builder/utils/renderSvgStrings.ts",
  "src/components/auth/PasscodeEditModal.tsx",
  "src/components/auth/UserEditModal.tsx",
  "src/components/classroom/ClassroomManagementTable.tsx",
  "src/components/classroom/ClassroomStudentImportModal.tsx",
  "src/components/common/ScreenBlackout.tsx",
  "src/components/common/student-add-panel/hooks/useStudentAddPanel.ts",
  "src/components/exams/01-upload/hooks/useMasterAnswers.ts",
  "src/components/exams/01-upload/utils/imageUtils.ts",
  "src/components/exams/02-template/components/CropRegionEditor.tsx",
  "src/components/exams/02-template/hooks/useCropRegionSave.ts",
  "src/components/exams/02-template/hooks/useTemplateData.ts",
  "src/components/exams/03-region-info/components/RegionDetailsTable.tsx",
  "src/components/exams/03-region-info/hooks/useDragAndDrop.ts",
  "src/components/exams/03-region-info/hooks/useOmrConfig.ts",
  "src/components/exams/04-question-group/components/SubtotalGroupSelector.tsx",
  "src/components/exams/05-students/components/ClassroomExamManager.tsx",
  "src/components/exams/05-students/components/exam-student-add-modal/components/ExamStudentAddModalContainer.tsx",
  "src/components/exams/05-students/components/exam-students-page/hooks/useExamStudentsData.ts",
  "src/components/exams/05-students/hooks/useExamClassrooms.ts",
  "src/components/exams/06-student-answers/student-answer-management/hooks/useStudentAnswerUpload.ts",
  "src/components/exams/06-student-answers/student-answer-table/components/DeleteConfirmationModal.tsx",
  "src/components/exams/06-student-answers/student-answer-table/hooks/useAnswerTableCore.ts",
  "src/components/exams/06-student-answers/student-answer-table/hooks/useMarkerCorrection.ts",
  "src/components/exams/06-student-answers/student-answer-table/hooks/useNameRegion.ts",
  "src/components/exams/06-student-answers/student-answer-table/utils/studentAnswerImageCache.ts",
  "src/components/exams/07-score-at-once/OMRRecognition/hooks/useOmrAutoScoring.ts",
  "src/components/exams/07-score-at-once/ScoringData/hooks/useBatchScoring.ts",
  "src/components/exams/07-score-at-once/ScoringData/utils/dataLoader.ts",
  "src/components/exams/07-score-at-once/ScoringGrid/hooks/useGridAnnotations.ts",
  "src/components/exams/07-score-at-once/ScoringIndividual/AnswerIndividualView.tsx",
  "src/components/exams/07-score-at-once/ScoringIndividual/hooks/core/useDrawingAnnotations.ts",
  "src/components/exams/07-score-at-once/ScoringIndividual/hooks/core/useImageLoader.ts",
  "src/components/exams/07-score-at-once/ScoringIndividual/hooks/view/useAllStudentAnnotations.ts",
  "src/components/exams/07-score-at-once/ScoringIndividual/hooks/view/useAutoCreateQuestionScore.ts",
  "src/components/exams/07-score-at-once/ScoringMain/ScoreDecisionPanel/QuestionAssignmentRow.tsx",
  "src/components/exams/07-score-at-once/ScoringMain/ScoreDecisionPanel/ScoreDecisionForm.tsx",
  "src/components/exams/07-score-at-once/ScoringMain/ScoreDecisionPanel/hooks/useExamDecisionSummary.ts",
  "src/components/exams/07-score-at-once/ScoringMain/contexts/ShortcutProvider.tsx",
  "src/components/exams/07-score-at-once/ScoringMain/hooks/useAnswerWhiteness.ts",
  "src/components/exams/07-score-at-once/ScoringMain/hooks/useAssignedCropRegions.ts",
  "src/components/exams/07-score-at-once/ScoringMain/hooks/useScoringDataLoader.ts",
  "src/components/exams/07-score-at-once/ScoringSidePanel/AnnotationBrowserPanel.tsx",
  "src/components/exams/07-score-at-once/ScoringSidePanel/hooks/useAnnotationBrowser.ts",
  "src/components/exams/08-export/ExportMainView.tsx",
  "src/components/exams/08-export/components/StatisticsClassroomSelector.tsx",
  "src/components/exams/08-export/components/individual-report/SubtotalGroupSelector.tsx",
  "src/components/exams/08-export/hooks/useDataFileExports.ts",
  "src/components/exams/08-export/hooks/useExcelPreview.ts",
  "src/components/exams/08-export/hooks/useExportPage.ts",
  "src/components/exams/08-export/hooks/useIndividualReportPreview.ts",
  "src/components/exams/08-export/hooks/useReturnDiff.ts",
  "src/components/exams/08-export/hooks/useScoredAnswerPdfExport.ts",
  "src/components/exams/08-export/hooks/useScoredAnswerPreview.ts",
  "src/components/exams/08-export/utils/loadStudentExportPlacements.ts",
  "src/components/exams/08-export/utils/pdfCanvasRenderer/annotationRenderer.ts",
  "src/components/exams/forms/CreateExamWindow.tsx",
  "src/components/exams/forms/EditExamWindow.tsx",
  "src/components/exams/list/ExamList.tsx",
  "src/components/exams/shared/DeleteExamModal.tsx",
  "src/components/exams/shared/MemberInviteDialog.tsx",
  "src/components/hooks/useExams.ts",
  "src/components/pdf-tools/export-panel/ExportActions.tsx",
  "src/components/pdf-tools/import-panel/FileDropzone.tsx",
  "src/components/pdf-tools/import-panel/hooks/useImportedFiles.ts",
  "src/components/student/StudentArchiveExportDialog.tsx",
  "src/components/student/StudentTable.tsx",
  "src/components/subtotal-groups/SubtotalGroupsPageContainer.tsx",
  "src/components/subtotal-groups/components/SubtotalGroupModal.tsx",
  "src/components/tag/TagsPageContainer.tsx",
  "src/contexts/AuthContext.tsx",
  "src/hooks/import/useImportWizard.ts",
  "src/hooks/student-import/useStudentImportWizard.ts",
  "src/hooks/useExamDetail.ts",
  "src/hooks/useNavigationHistory.ts",
  "src/hooks/useStudentImport.ts",
  "src/lib/scoringStatusColors.ts",
  "src/types/electron.d.ts",
]

describe("IPC 境界の規約", () => {
  const registered = collectRegisteredChannels()
  const invoked = collectInvokedChannels()

  it("走査そのものが機能している（チャンネルを見つけられている）", () => {
    expect(registered.size).toBeGreaterThan(200)
    expect(invoked.size).toBeGreaterThan(200)
  })

  it("登録したチャンネルは preload から呼ばれている", () => {
    const dead = [...registered.entries()]
      .filter(([channel]) => !invoked.has(channel))
      .map(([channel, file]) => `${channel} (${file})`)

    expect(dead).toEqual([])
  })

  it("preload の呼び出しは全て登録されている", () => {
    const missing = [...invoked].filter((channel) => !registered.has(channel))

    expect(missing).toEqual([])
  })

  it("src から electron-src を値で引くのは名指しの一覧だけ", () => {
    expect(collectValueImports()).toEqual([])
  })

  it("DB へのアクセスは src/queries/ に集める（残りは名指しの一覧）", () => {
    const touching = listFiles("src/")
      .filter((relativePath) => /\.tsx?$/.test(relativePath))
      .filter((relativePath) => !relativePath.startsWith("src/queries/"))
      .filter((relativePath) =>
        fs
          .readFileSync(path.join(REPO_ROOT, relativePath), "utf8")
          .includes("window.electronAPI")
      )

    const added = touching.filter(
      (relativePath) => !NOT_YET_MIGRATED.includes(relativePath)
    )
    expect(added).toEqual([])
  })
})
