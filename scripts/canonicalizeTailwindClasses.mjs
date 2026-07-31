#!/usr/bin/env node
/**
 * Tailwind のクラス名を canonical 形式へ揃える（`w-[24px]` → `w-6` 等）。
 *
 * VSCode の Tailwind CSS IntelliSense が `suggestCanonicalClasses` として出す
 * 警告と同じ判定を使う。判定の実体は拡張ではなく tailwindcss 本体の
 * `designSystem.canonicalizeCandidates()` なので、それを直接呼んでいる。
 *
 * prettier-plugin-tailwindcss は並び替えのみでリネームはしないため、
 * `npm run format` の前段としてこのスクリプトを挟む。
 *
 *   node scripts/canonicalizeTailwindClasses.mjs           書き換える
 *   node scripts/canonicalizeTailwindClasses.mjs --check   差分があれば異常終了
 */
import * as fs from "node:fs/promises"
import * as path from "node:path"
import * as url from "node:url"
import ts from "typescript"
import { __unstable__loadDesignSystem } from "tailwindcss"

const projectRoot = path.resolve(
  path.dirname(url.fileURLToPath(import.meta.url)),
  ".."
)
const stylesheetPath = path.join(projectRoot, "src/app/globals.css")
const targetRoot = path.join(projectRoot, "src")
const targetExtensions = [".tsx", ".ts", ".jsx", ".js"]

/** クラス名を書いてよい JSX 属性 */
const classAttributes = new Set(["className", "class"])

/** クラス名を引数に取る関数（prettier-plugin-tailwindcss の既定に合わせる） */
const classFunctions = new Set(["cn", "clsx", "cva", "twMerge", "classNames"])

/** `:root` 等で実行時に上書きされる CSS 変数（main で初期化する） */
let runtimeOverriddenVariables = new Set()

/**
 * `@import` を実ファイルへ解決する。theme.css（Tailwind 既定のスケール）は
 * index.css からの相対 import で入ってくるため、ここを手抜きすると
 * 既定テーマが空のまま読み込まれ、誤った canonical 候補が出る。
 */
async function resolveStylesheet(id, base) {
  if (id.startsWith(".") || path.isAbsolute(id)) {
    return path.resolve(base, id)
  }
  const packageName = id.startsWith("@")
    ? id.split("/").slice(0, 2).join("/")
    : id.split("/")[0]
  const subPath = id.slice(packageName.length).replace(/^\//, "")
  // package.json を exports に載せていないパッケージ（tw-animate-css 等）が
  // あるので require.resolve には頼らず node_modules を直接見る。
  const packageDirectory = path.join(projectRoot, "node_modules", packageName)
  const packageJsonPath = path.join(packageDirectory, "package.json")
  if (subPath) return path.join(packageDirectory, subPath)

  const packageJson = JSON.parse(await fs.readFile(packageJsonPath, "utf8"))
  const styleEntry =
    packageJson.style ?? packageJson.exports?.["."]?.style ?? packageJson.main
  return path.join(packageDirectory, styleEntry)
}

/**
 * `@theme` の外（`:root` や `.dark`）で宣言され、実行時に値が変わる変数を集める。
 *
 * `--radius` のように「Tailwind 既定値が theme にあり、`:root` で別の値に
 * 上書きされている」変数は、静的解析（designSystem）と実際の描画で値が食い違う。
 * この差を無視すると `rounded-[4px]` → `rounded-lg`（4px → 10px）のような
 * 見た目の変わる変換を通してしまう。
 */
async function collectRuntimeOverriddenVariables() {
  const css = await fs.readFile(stylesheetPath, "utf8")
  const withoutThemeBlocks = css.replace(/@theme[^{]*\{[^}]*\}/g, "")
  return new Set(
    [...withoutThemeBlocks.matchAll(/(--[\w-]+)\s*:/g)].map((match) => match[1])
  )
}

async function loadDesignSystem() {
  const css = await fs.readFile(stylesheetPath, "utf8")
  return __unstable__loadDesignSystem(css, {
    base: path.dirname(stylesheetPath),
    loadStylesheet: async (id, base) => {
      const resolved = await resolveStylesheet(id, base)
      return {
        base: path.dirname(resolved),
        path: resolved,
        content: await fs.readFile(resolved, "utf8"),
      }
    },
    loadModule: async () => ({ base: projectRoot, module: {} }),
  })
}

async function collectSourceFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true })
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name)
      if (entry.isDirectory()) return collectSourceFiles(entryPath)
      return targetExtensions.includes(path.extname(entry.name))
        ? [entryPath]
        : []
    })
  )
  return files.flat()
}

/**
 * クラス名を並べた文字列リテラル・テンプレートリテラルの位置を集める。
 * 空白は元のまま残し、クラス名のトークンだけを差し替えたいので、
 * ノードそのものではなく「クォートの内側」の範囲を返す。
 */
function collectClassRanges(sourceFile) {
  const ranges = []

  const addLiteral = (node) => {
    if (ts.isStringLiteralLike(node)) {
      ranges.push({ start: node.getStart(sourceFile) + 1, end: node.end - 1 })
      return
    }
    if (ts.isTemplateExpression(node)) {
      // `${}` を挟む静的部分のみを対象にする
      addLiteral(node.head)
      node.templateSpans.forEach((span) => addLiteral(span.literal))
      return
    }
    if (ts.isNoSubstitutionTemplateLiteral(node)) {
      ranges.push({ start: node.getStart(sourceFile) + 1, end: node.end - 1 })
      return
    }
    if (ts.isConditionalExpression(node)) {
      addLiteral(node.whenTrue)
      addLiteral(node.whenFalse)
      return
    }
    if (ts.isBinaryExpression(node)) {
      addLiteral(node.left)
      addLiteral(node.right)
      return
    }
    if (ts.isParenthesizedExpression(node)) {
      addLiteral(node.expression)
      return
    }
    if (ts.isArrayLiteralExpression(node)) {
      node.elements.forEach(addLiteral)
      return
    }
    if (ts.isObjectLiteralExpression(node)) {
      // cva の variants など。キー側がクラス名になる形式は扱わない
      node.properties.forEach((property) => {
        if (ts.isPropertyAssignment(property)) addLiteral(property.initializer)
      })
      return
    }
    if (ts.isCallExpression(node)) {
      node.arguments.forEach(addLiteral)
    }
  }

  const visit = (node) => {
    if (ts.isJsxAttribute(node) && node.initializer) {
      const attributeName = node.name.getText(sourceFile)
      if (classAttributes.has(attributeName)) {
        addLiteral(
          ts.isJsxExpression(node.initializer) && node.initializer.expression
            ? node.initializer.expression
            : node.initializer
        )
      }
    }

    if (ts.isCallExpression(node)) {
      const callee = node.expression
      const calleeName = ts.isIdentifier(callee)
        ? callee.text
        : ts.isPropertyAccessExpression(callee)
          ? callee.name.text
          : null
      if (calleeName && classFunctions.has(calleeName)) {
        node.arguments.forEach(addLiteral)
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  // 入れ子（cn() を className に渡す等）で重複するので取り除く
  const seen = new Set()
  return ranges.filter((range) => {
    const key = `${range.start}:${range.end}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/**
 * `calc(var(--spacing) * 6)` のような長さを px 数値へ畳む。
 * theme に無い変数（`:root` 側でしか定義されていない `--radius` 等）は
 * 解決できないので null を返す。
 */
function toPixels(expression, designSystem, depth = 0) {
  if (depth > 8) return null

  const variableMatch = expression.match(/^var\((--[\w-]+)\)$/)
  if (variableMatch) {
    // 実行時に上書きされる変数は静的には値を確定できない
    if (runtimeOverriddenVariables.has(variableMatch[1])) return null
    const themeValue = designSystem.theme.get([variableMatch[1]])
    return themeValue ? toPixels(themeValue, designSystem, depth + 1) : null
  }

  const calcMatch = expression.match(/^calc\((.*)\)$/s)
  if (calcMatch) {
    // calc の + と - は前後の空白が必須なので、空白で切れば符号と紛れない
    const parts = calcMatch[1].trim().split(/\s+/)
    if (parts.length !== 3) return null
    const [left, operator, right] = parts
    const leftPixels = toPixels(left, designSystem, depth + 1)
    const rightPixels =
      operator === "*" || operator === "/"
        ? Number(right)
        : toPixels(right, designSystem, depth + 1)
    if (
      leftPixels === null ||
      rightPixels === null ||
      Number.isNaN(rightPixels)
    )
      return null
    if (operator === "*") return leftPixels * rightPixels
    if (operator === "/") return leftPixels / rightPixels
    if (operator === "+") return leftPixels + rightPixels
    return leftPixels - rightPixels
  }

  const lengthMatch = expression.match(/^(-?[\d.]+)(px|rem|em)?$/)
  if (!lengthMatch) return null
  const amount = Number(lengthMatch[1])
  if (Number.isNaN(amount)) return null
  if (lengthMatch[2] === "rem" || lengthMatch[2] === "em") return amount * 16
  if (lengthMatch[2] === "px" || amount === 0) return amount
  return null
}

/** 生成 CSS を「セレクタを除き、長さを px に畳んだ形」へ正規化する */
function normalizeGeneratedCss(css, designSystem) {
  const body = css.slice(css.indexOf("{"))
  return body.replace(
    /calc\((?:[^()]|\([^()]*\))*\)|var\(--[\w-]+\)|-?[\d.]+(?:px|rem|em)\b/g,
    (expression) => {
      const pixels = toPixels(expression, designSystem)
      return pixels === null ? `<unresolved:${expression}>` : `${pixels}px`
    }
  )
}

/**
 * 変換前後で生成 CSS が完全に一致するときだけ採用する。
 * tailwindcss の canonicalize は `@theme inline` で `var()` 上書きされた
 * スケール（この試験では `--radius-*`）に対して見た目の変わる候補を返すため。
 */
function isEquivalent(original, canonical, designSystem) {
  try {
    const [originalCss, canonicalCss] = designSystem.candidatesToCss([
      original,
      canonical,
    ])
    if (!originalCss || !canonicalCss) return false
    return (
      normalizeGeneratedCss(originalCss, designSystem) ===
      normalizeGeneratedCss(canonicalCss, designSystem)
    )
  } catch {
    return false
  }
}

function canonicalizeRange(text, designSystem, changes, rejections) {
  const tokens = text.split(/(\s+)/)
  const candidates = tokens.filter((token) => token.trim() !== "")
  if (candidates.length === 0) return text
  const canonical = designSystem.canonicalizeCandidates(candidates, { rem: 16 })
  let cursor = 0
  return tokens
    .map((token) => {
      if (token.trim() === "") return token
      const canonicalName = canonical[cursor++]
      if (canonicalName === token) return token
      if (!isEquivalent(token, canonicalName, designSystem)) {
        rejections.push(`${token} -> ${canonicalName}`)
        return token
      }
      changes.push(`${token} -> ${canonicalName}`)
      return canonicalName
    })
    .join("")
}

async function main() {
  const checkOnly = process.argv.includes("--check")
  runtimeOverriddenVariables = await collectRuntimeOverriddenVariables()
  const designSystem = await loadDesignSystem()
  const files = await collectSourceFiles(targetRoot)

  let changedFileCount = 0
  let changedClassCount = 0
  const allRejections = []

  for (const filePath of files) {
    const source = await fs.readFile(filePath, "utf8")
    if (!source.includes("class")) continue

    const sourceFile = ts.createSourceFile(
      filePath,
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX
    )
    const ranges = collectClassRanges(sourceFile)
    if (ranges.length === 0) continue

    const changes = []
    const rejections = []
    // 後ろから差し替えれば前方の位置がずれない
    let next = source
    for (const range of ranges.sort((a, b) => b.start - a.start)) {
      const original = next.slice(range.start, range.end)
      const canonical = canonicalizeRange(
        original,
        designSystem,
        changes,
        rejections
      )
      if (canonical !== original) {
        next = next.slice(0, range.start) + canonical + next.slice(range.end)
      }
    }

    const relativePath = path.relative(projectRoot, filePath)
    rejections.forEach((rejection) =>
      allRejections.push(`${relativePath}  ${rejection}`)
    )

    if (next === source) continue
    changedFileCount++
    changedClassCount += changes.length
    console.log(relativePath)
    changes.forEach((change) => console.log(`    ${change}`))
    if (!checkOnly) await fs.writeFile(filePath, next, "utf8")
  }

  if (allRejections.length > 0) {
    // VSCode 側には警告が出続けるので、見送った理由が分かるよう明示する
    console.log(
      `\n生成 CSS が変わるため見送った候補（${allRejections.length} 件）:`
    )
    allRejections.forEach((rejection) => console.log(`    ${rejection}`))
  }

  if (changedFileCount === 0) return

  if (checkOnly) {
    console.error(
      `\n${changedClassCount} 個のクラスが canonical 形式ではありません。` +
        `\nnpm run format で修正してください。`
    )
    process.exitCode = 1
    return
  }
  console.log(
    `\n${changedFileCount} ファイル / ${changedClassCount} クラスを修正しました。`
  )
}

await main()
