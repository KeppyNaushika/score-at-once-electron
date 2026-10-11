/**
 * 端末ごとの設定ファイルの口（`electron-src/lib/jsonFileStore.ts`）。
 *
 * 書き込みを非同期にしても、重なった更新が同じ古い中身から作られて片方が消えないこと、
 * 書けなかったときにメモリの写しが変わらないことを見る
 */
import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { createJsonFileStore } from "../../electron-src/lib/jsonFileStore"

interface Counter {
  count: number
}

const toCounter = (parsed: unknown): Counter => ({
  count:
    typeof parsed === "object" &&
    parsed !== null &&
    "count" in parsed &&
    typeof parsed.count === "number"
      ? parsed.count
      : 0,
})

describe("jsonFileStore", () => {
  let temporaryDirectory: string
  let filePath: string

  const createStore = () =>
    createJsonFileStore<Counter>({
      filePath,
      parse: toCounter,
      createDefault: () => ({ count: 0 }),
    })

  beforeEach(() => {
    temporaryDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), "json-file-store-test-")
    )
    filePath = path.join(temporaryDirectory, "nested", "counter.json")
  })

  afterEach(() => {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true })
  })

  it("読み込む前に読むと投げる（既定値を返すと、次の書き込みが既定値で上書きする）", () => {
    expect(() => createStore().read()).toThrow(/まだ読み込んでいません/)
  })

  it("ファイルが無ければ既定値。書いた中身は次に開いたときに読める", async () => {
    const store = createStore()
    await store.load()
    expect(store.read()).toEqual({ count: 0 })

    await store.update((counter) => ({ count: counter.count + 1 }))
    expect(store.read()).toEqual({ count: 1 })

    const reopenedStore = createStore()
    await reopenedStore.load()
    expect(reopenedStore.read()).toEqual({ count: 1 })
  })

  it("壊れたファイルは既定値で読む", async () => {
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.writeFileSync(filePath, "{ not json", "utf-8")
    const store = createStore()
    await store.load()
    expect(store.read()).toEqual({ count: 0 })
  })

  it("重なった更新は1件ずつ通り、どれも消えない", async () => {
    const store = createStore()
    await store.load()
    await Promise.all(
      Array.from({ length: 20 }, () =>
        store.update((counter) => ({ count: counter.count + 1 }))
      )
    )
    expect(store.read()).toEqual({ count: 20 })
    expect(JSON.parse(fs.readFileSync(filePath, "utf-8"))).toEqual({
      count: 20,
    })
  })

  it("更新が失敗すれば、メモリもファイルも変えずに投げ、次の更新は通る", async () => {
    const store = createStore()
    await store.load()
    await store.update(() => ({ count: 5 }))

    await expect(
      store.update(() => {
        throw new Error("直せない")
      })
    ).rejects.toThrow("直せない")
    expect(store.read()).toEqual({ count: 5 })
    expect(JSON.parse(fs.readFileSync(filePath, "utf-8"))).toEqual({
      count: 5,
    })

    await store.update((counter) => ({ count: counter.count + 1 }))
    expect(store.read()).toEqual({ count: 6 })
  })
})
