import * as fsPromises from "fs/promises"
import * as path from "path"

/**
 * 端末ごとの小さな設定を JSON ファイル1つに置く口（認証・AI採点の事業者の設定など）。
 *
 * **中身は起動時に1回だけ読み（`load`）、以後はメモリの写しを正とする。** 読むのは同期
 * （`read`）、書くのは非同期（`update`）。
 *
 * - 読むのを同期のまま保つのは、読む側が同期の関数の奥（監査ログの操作者、AI採点の
 *   並列数など）にあるため
 * - 書き込みは1本の列に並べ、「読んで、直して、書く」を1件ずつ終わらせる。ファイルを
 *   非同期で読み書きしても、2つの更新が同じ古い中身から作られて片方が消えることはない
 * - 書きかけのファイルが残らないよう、一時ファイルに書いてから置き換える。書けなかった
 *   ときはメモリの写しも変えずに投げる（ファイルとメモリが食い違わない）
 *
 * ファイルの読み書きを非同期にしてあるのは、web 版の保存先（OPFS）にファイルを同期で
 * 開く手段が無いため。
 */
export interface JsonFileStore<T> {
  /** ファイルを読んでメモリに置く。何度呼んでも読むのは最初の1回だけ */
  load(): Promise<void>
  /** メモリの写し。`load` の前に呼ぶと投げる（既定値を返すと、次の書き込みが既定値で上書きする） */
  read(): T
  /** 今の中身から次の中身を作って書く。前の書き込みが終わってから始まる */
  update(change: (current: T) => T): Promise<T>
}

export interface JsonFileStoreOptions<T> {
  filePath: string
  /** 読んだ JSON を形に合わせる（崩れていれば既定値で埋める） */
  parse: (parsed: unknown) => T
  /** ファイルが無い・読めないときの中身 */
  createDefault: () => T
  /** 書くファイルの権限（API キーなど、他の利用者に読ませないもの） */
  fileMode?: number
}

const isMissingFile = (error: unknown) =>
  error instanceof Error && "code" in error && error.code === "ENOENT"

export function createJsonFileStore<T>(
  options: JsonFileStoreOptions<T>
): JsonFileStore<T> {
  const { filePath, parse, createDefault, fileMode } = options
  let loading: Promise<void> | null = null
  /** 読み込んだあとのメモリの写し（読み込む前は null） */
  let loadedState: { contents: T } | null = null
  let writing: Promise<unknown> = Promise.resolve()

  const readFile = async (): Promise<T> => {
    try {
      const parsed: unknown = JSON.parse(
        await fsPromises.readFile(filePath, "utf-8")
      )
      return parse(parsed)
    } catch (error) {
      if (!isMissingFile(error)) {
        console.error(`Failed to load ${filePath}:`, error)
      }
      return createDefault()
    }
  }

  const writeFile = async (contents: T) => {
    await fsPromises.mkdir(path.dirname(filePath), { recursive: true })
    const temporaryPath = `${filePath}.tmp`
    await fsPromises.writeFile(
      temporaryPath,
      JSON.stringify(contents, null, 2),
      {
        encoding: "utf-8",
        ...(fileMode === undefined ? {} : { mode: fileMode }),
      }
    )
    await fsPromises.rename(temporaryPath, filePath)
  }

  const load = () => {
    loading ??= readFile().then((contents) => {
      loadedState = { contents }
    })
    return loading
  }

  const read = (): T => {
    if (!loadedState) {
      throw new Error(
        `${filePath} をまだ読み込んでいません（先に load を呼ぶ）`
      )
    }
    return loadedState.contents
  }

  const update = (change: (current: T) => T): Promise<T> => {
    const next = writing.then(async () => {
      await load()
      const contents = change(read())
      await writeFile(contents)
      loadedState = { contents }
      return contents
    })
    // 失敗した書き込みで列を止めない（失敗は呼んだ側へ返す）
    writing = next.catch(() => {})
    return next
  }

  return { load, read, update }
}
