/**
 * データフォルダ（共有するファイルの根など）の中にパスを閉じ込める規則。
 *
 * DB の `imagePath`・画面から来た相対パス・id からファイルのパスを組む箇所は、組んだ結果が
 * 根の外を指さないことをここで確かめる。取り込みでの値の検査とは独立した、もう1段の守り。
 *
 * 字面（文字列）だけで判断する。シンボリックリンクの先は追わない（根の中に置かれたリンクは
 * 根の持ち主が置いたものとして扱う）。
 *
 * web 版でも同じコードが Worker で動く。そこでの `path` は path-browserify（区切りは `/`、
 * `path.posix` も同じもの）で、根は `/opfs/data` のような仮想の絶対パス。`path.resolve` は
 * `process.cwd()` に頼るので使わず、`path.join` と `path.relative`（どちらも絶対パス同士なら
 * cwd を読まない）だけで判断する。
 */

import * as path from "path"

type ResolvedUnderRoot =
  | {
      readonly kind: "ok"
      /** 根の下の絶対パス */
      readonly absolutePath: string
      /** 根からの `/` 区切りの正規化した相対パス（`.`・`..`・空の区切りを含まない） */
      readonly normalizedRelativePath: string
    }
  | { readonly kind: "outsideRoot" }

/** 根の外を指すパスを断ったときの例外 */
export class PathOutsideRootError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "PathOutsideRootError"
  }
}

/**
 * `absolutePath` が `rootDirectory` の下にあるか（根そのものは含めない）。
 * どちらも絶対パスで渡す。
 */
export function isStrictlyUnderRoot(
  rootDirectory: string,
  absolutePath: string
): boolean {
  if (!path.isAbsolute(rootDirectory) || !path.isAbsolute(absolutePath)) {
    return false
  }
  if (absolutePath.includes("\0")) return false
  const fromRoot = path.relative(rootDirectory, absolutePath)
  return !(
    fromRoot === "" ||
    fromRoot === ".." ||
    fromRoot.startsWith(`..${path.sep}`) ||
    fromRoot.startsWith("../") ||
    path.isAbsolute(fromRoot)
  )
}

/**
 * 根からの相対パスを、`/` 区切りの正規化した形にする。根の外・根そのものを指すなら null。
 *
 * 次のものは断る:
 * - 空・NUL を含むもの
 * - 絶対パス（`/` や `\` で始まるもの、`C:` のようなドライブ名で始まるもの）
 * - 正規化すると根そのもの（`.`）か、根の外（`..` で始まる）になるもの
 *
 * `\` は区切りとして扱う（Windows で書かれた相対パスも同じに読むため）。
 */
function normalizeRelativePath(relativePath: string): string | null {
  if (relativePath === "" || relativePath.includes("\0")) return null
  const slashPath = relativePath.replaceAll("\\", "/")
  if (
    path.isAbsolute(relativePath) ||
    path.posix.isAbsolute(slashPath) ||
    /^[A-Za-z]:/.test(slashPath)
  ) {
    return null
  }
  const normalizedRelativePath = path.posix.normalize(slashPath)
  if (
    normalizedRelativePath === "." ||
    normalizedRelativePath === ".." ||
    normalizedRelativePath.startsWith("../")
  ) {
    return null
  }
  return normalizedRelativePath
}

/**
 * 根からの相対パスを、根の下の絶対パスに解決する。根の外・根そのものを指すなら
 * `outsideRoot`（断るものは {@link normalizeRelativePath} を参照）。
 */
export function resolveUnderRoot(
  rootDirectory: string,
  relativePath: string
): ResolvedUnderRoot {
  const normalizedRelativePath = normalizeRelativePath(relativePath)
  if (normalizedRelativePath === null) return { kind: "outsideRoot" }
  const absolutePath = path.join(
    rootDirectory,
    ...normalizedRelativePath.split("/")
  )
  if (!isStrictlyUnderRoot(rootDirectory, absolutePath)) {
    return { kind: "outsideRoot" }
  }
  return { kind: "ok", absolutePath, normalizedRelativePath }
}

/**
 * 根からの相対パスが、根の下の決まったディレクトリ（例: `["exams"]`）の、さらに下を指すか。
 * 消す先を、そのディレクトリの中のファイルに絞るときに使う（根の直下の DB などを守る）
 */
export function isRelativePathInside(
  relativePath: string,
  directorySegments: readonly string[]
): boolean {
  const normalizedRelativePath = normalizeRelativePath(relativePath)
  if (normalizedRelativePath === null) return false
  const segments = normalizedRelativePath
    .split("/")
    .filter((segment) => segment !== "")
  return (
    segments.length > directorySegments.length &&
    directorySegments.every(
      (directorySegment, index) => segments[index] === directorySegment
    )
  )
}

/** {@link resolveUnderRoot} の例外版。根の外を指すなら {@link PathOutsideRootError} を投げる */
export function requireUnderRoot(
  rootDirectory: string,
  relativePath: string
): string {
  const resolved = resolveUnderRoot(rootDirectory, relativePath)
  if (resolved.kind !== "ok") {
    throw new PathOutsideRootError(
      `データフォルダの外を指すパスは扱えません: ${JSON.stringify(relativePath)}`
    )
  }
  return resolved.absolutePath
}

/**
 * パスの1区切りとして使える id の形。英数字・`-`・`_` だけ（128字まで）。
 *
 * id は今は uuidv4 だが、初期の版（2025年5月まで）は cuid（英小文字と数字）で作っていて、
 * そのころのデータの id は今も cuid のまま残りうる。uuid に限ると古いデータの試験の
 * フォルダを扱えなくなるので、両方を含み、区切り文字・`.`・`:`・NUL を含まない形に絞る。
 */
const SAFE_PATH_SEGMENT_PATTERN = /^[A-Za-z0-9_-]{1,128}$/

/** id がパスの1区切りとして安全か */
export function isSafePathSegment(segment: string): boolean {
  return SAFE_PATH_SEGMENT_PATTERN.test(segment)
}

/** id がパスの1区切りとして安全でなければ {@link PathOutsideRootError} を投げる */
export function requireSafePathSegment(segment: string): string {
  if (!isSafePathSegment(segment)) {
    throw new PathOutsideRootError(
      `パスに使えない id です: ${JSON.stringify(segment)}`
    )
  }
  return segment
}

/**
 * 再帰削除の前に、消す先が根の下にあり、根そのものでないことを確かめる。
 * 外れたら {@link PathOutsideRootError} を投げる（何も消さない）。
 */
export function requireRemovableUnderRoot(
  rootDirectory: string,
  absolutePath: string
): string {
  if (!isStrictlyUnderRoot(rootDirectory, absolutePath)) {
    throw new PathOutsideRootError(
      `データフォルダの中でない場所は消せません: ${JSON.stringify(absolutePath)}`
    )
  }
  return absolutePath
}
