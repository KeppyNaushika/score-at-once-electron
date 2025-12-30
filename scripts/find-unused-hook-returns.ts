/**
 * @fileoverview フックの未使用返り値を検出するスクリプト
 *
 * 使用方法:
 *   npx ts-node scripts/find-unused-hook-returns.ts
 *
 * または package.json に追加:
 *   "check:hooks": "ts-node scripts/find-unused-hook-returns.ts"
 */

import * as fs from "fs"
import * as path from "path"
import * as ts from "typescript"

interface HookReturnValue {
  hookName: string
  filePath: string
  returnedProperties: string[]
}

interface HookUsage {
  hookName: string
  filePath: string
  line: number
  destructuredProperties: string[]
}

interface UnusedReturnReport {
  hookName: string
  hookFilePath: string
  unusedProperties: string[]
  usageCount: number
}

/**
 * 指定ディレクトリ内のTypeScript/TSXファイルを再帰的に取得
 */
function getTypeScriptFiles(dir: string, files: string[] = []): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)

    // 除外ディレクトリ
    if (
      entry.isDirectory() &&
      !["node_modules", ".next", "out", "main", "dist", ".git"].includes(
        entry.name
      )
    ) {
      getTypeScriptFiles(fullPath, files)
    } else if (
      entry.isFile() &&
      (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) &&
      !entry.name.endsWith(".d.ts")
    ) {
      files.push(fullPath)
    }
  }

  return files
}

/**
 * フック関数の直接の返り値プロパティのみを抽出（ネスト関数を除外）
 */
function extractDirectReturnProperties(
  funcBody: ts.Block | ts.ConciseBody
): string[] {
  const returnedProperties: string[] = []

  // Block bodyの場合のみ処理
  if (!ts.isBlock(funcBody)) {
    // Arrow function with expression body: () => ({ a, b })
    if (ts.isObjectLiteralExpression(funcBody)) {
      for (const prop of funcBody.properties) {
        if (ts.isShorthandPropertyAssignment(prop)) {
          returnedProperties.push(prop.name.text)
        } else if (
          ts.isPropertyAssignment(prop) &&
          ts.isIdentifier(prop.name)
        ) {
          returnedProperties.push(prop.name.text)
        }
      }
    }
    return returnedProperties
  }

  // 直接の子ノードのみを走査（ネストした関数は除外）
  for (const statement of funcBody.statements) {
    if (ts.isReturnStatement(statement) && statement.expression) {
      // return { a, b, c } パターン
      if (ts.isObjectLiteralExpression(statement.expression)) {
        for (const prop of statement.expression.properties) {
          if (ts.isShorthandPropertyAssignment(prop)) {
            returnedProperties.push(prop.name.text)
          } else if (
            ts.isPropertyAssignment(prop) &&
            ts.isIdentifier(prop.name)
          ) {
            returnedProperties.push(prop.name.text)
          }
        }
      }
    }
  }

  return returnedProperties
}

/**
 * フック定義ファイル（use*.ts）から返り値のプロパティを抽出
 */
function extractHookReturns(
  filePath: string,
  sourceFile: ts.SourceFile
): HookReturnValue | null {
  const fileName = path.basename(filePath, path.extname(filePath))

  // use*.ts パターンにマッチしない場合はスキップ
  if (!fileName.startsWith("use") || fileName.includes(".test")) {
    return null
  }

  let hookName = ""
  let returnedProperties: string[] = []

  function visit(node: ts.Node) {
    // 既にフックを見つけている場合はスキップ
    if (hookName && returnedProperties.length > 0) {
      return
    }

    // export function useXxx()
    if (
      ts.isFunctionDeclaration(node) &&
      node.name &&
      node.name.text.startsWith("use") &&
      node.body
    ) {
      hookName = node.name.text
      returnedProperties = extractDirectReturnProperties(node.body)
      return
    }

    // export const useXxx = () => {} または export const useXxx = function() {}
    if (ts.isVariableStatement(node)) {
      const declaration = node.declarationList.declarations[0]
      if (
        declaration &&
        ts.isIdentifier(declaration.name) &&
        declaration.name.text.startsWith("use") &&
        declaration.initializer
      ) {
        if (ts.isArrowFunction(declaration.initializer)) {
          hookName = declaration.name.text
          if (declaration.initializer.body) {
            returnedProperties = extractDirectReturnProperties(
              declaration.initializer.body
            )
          }
          return
        }
        if (
          ts.isFunctionExpression(declaration.initializer) &&
          declaration.initializer.body
        ) {
          hookName = declaration.name.text
          returnedProperties = extractDirectReturnProperties(
            declaration.initializer.body
          )
          return
        }
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)

  if (hookName && returnedProperties.length > 0) {
    return {
      hookName,
      filePath,
      returnedProperties: [...new Set(returnedProperties)],
    }
  }

  return null
}

/**
 * ファイル内のフック使用箇所から分割代入されたプロパティを抽出
 */
function extractHookUsages(
  filePath: string,
  sourceFile: ts.SourceFile,
  hookNames: Set<string>
): HookUsage[] {
  const usages: HookUsage[] = []

  function visit(node: ts.Node) {
    // const { a, b } = useXxx() パターン
    if (
      ts.isVariableDeclaration(node) &&
      ts.isObjectBindingPattern(node.name) &&
      node.initializer &&
      ts.isCallExpression(node.initializer)
    ) {
      const callExpr = node.initializer
      let hookName = ""

      if (ts.isIdentifier(callExpr.expression)) {
        hookName = callExpr.expression.text
      }

      if (hookName && hookNames.has(hookName)) {
        const destructuredProperties: string[] = []

        for (const element of node.name.elements) {
          if (ts.isBindingElement(element) && ts.isIdentifier(element.name)) {
            // プロパティ名を取得（リネームの場合は元の名前）
            const propName = element.propertyName
              ? ts.isIdentifier(element.propertyName)
                ? element.propertyName.text
                : element.name.text
              : element.name.text

            // アンダースコアプレフィックスでない場合のみ追加
            if (!element.name.text.startsWith("_")) {
              destructuredProperties.push(propName)
            }
          }
        }

        const { line } = sourceFile.getLineAndCharacterOfPosition(
          node.getStart()
        )

        usages.push({
          hookName,
          filePath,
          line: line + 1,
          destructuredProperties,
        })
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return usages
}

/**
 * メイン処理
 */
function main() {
  const projectRoot = process.cwd()

  // テストディレクトリを除外
  const excludeDirs = [
    "node_modules",
    ".next",
    "out",
    "main",
    "dist",
    ".git",
    "app/textbox-on-canvas", // テストページ
    "app/test-",
  ]

  const allFiles = getTypeScriptFiles(projectRoot)
  const files = allFiles.filter(
    (f) => !excludeDirs.some((dir) => f.includes(`/${dir}`))
  )

  console.log(`\n📁 ${files.length} 個のTypeScriptファイルを分析中...\n`)

  // Phase 1: フック定義を収集
  const hookReturns: Map<string, HookReturnValue> = new Map()

  for (const filePath of files) {
    const content = fs.readFileSync(filePath, "utf-8")
    const sourceFile = ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.Latest,
      true
    )

    const hookReturn = extractHookReturns(filePath, sourceFile)
    if (hookReturn) {
      hookReturns.set(hookReturn.hookName, hookReturn)
    }
  }

  console.log(`🪝 ${hookReturns.size} 個のカスタムフックを検出\n`)

  const hookNames = new Set(hookReturns.keys())

  // Phase 2: フック使用箇所を収集
  const allUsages: HookUsage[] = []

  for (const filePath of files) {
    const content = fs.readFileSync(filePath, "utf-8")
    const sourceFile = ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.Latest,
      true
    )

    const usages = extractHookUsages(filePath, sourceFile, hookNames)
    allUsages.push(...usages)
  }

  // Phase 3: 未使用の返り値を検出
  const reports: UnusedReturnReport[] = []

  for (const [hookName, hookReturn] of hookReturns) {
    const usagesForHook = allUsages.filter((u) => u.hookName === hookName)

    if (usagesForHook.length === 0) {
      // フックが使用されていない（別の問題）
      continue
    }

    // 全ての使用箇所で使われているプロパティを集計
    const usedPropertiesSet = new Set<string>()
    for (const usage of usagesForHook) {
      for (const prop of usage.destructuredProperties) {
        usedPropertiesSet.add(prop)
      }
    }

    // 返り値にあるが、どの使用箇所でも使われていないプロパティ
    const unusedProperties = hookReturn.returnedProperties.filter(
      (prop) => !usedPropertiesSet.has(prop)
    )

    if (unusedProperties.length > 0) {
      reports.push({
        hookName,
        hookFilePath: hookReturn.filePath,
        unusedProperties,
        usageCount: usagesForHook.length,
      })
    }
  }

  // Phase 4: レポート出力
  if (reports.length === 0) {
    console.log("✅ 未使用のフック返り値は検出されませんでした\n")
    return
  }

  console.log(`⚠️  ${reports.length} 個のフックで未使用の返り値を検出:\n`)
  console.log("─".repeat(80))

  for (const report of reports) {
    const relativePath = path.relative(projectRoot, report.hookFilePath)
    console.log(`\n🪝 ${report.hookName}`)
    console.log(`   📄 ${relativePath}`)
    console.log(`   📊 使用箇所: ${report.usageCount} 件`)
    console.log(`   ❌ 未使用の返り値:`)
    for (const prop of report.unusedProperties) {
      console.log(`      - ${prop}`)
    }
  }

  console.log("\n" + "─".repeat(80))
  console.log(
    `\n💡 ヒント: これらの返り値はどの呼び出し元でも使用されていません。`
  )
  console.log(
    `   フックの返り値から削除するか、実際に使用することを検討してください。\n`
  )

  // 終了コード（CI用）
  process.exit(reports.length > 0 ? 1 : 0)
}

main()
