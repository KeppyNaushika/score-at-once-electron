/**
 * Worker 側の `crypto`。main のコードが使う分（randomUUID・randomBytes・同期の sha256）だけ。
 *
 * `createHash("sha256")` は適用したマイグレーションの記録（`migrationApplier.ts` の checksum）が
 * 同期で呼ぶ。Web Crypto の digest は非同期なので、純 JS の実装で同じ値を出す。
 */
import { sha256 } from "@noble/hashes/sha2.js"
import { Buffer } from "buffer"

type HashInput = string | Uint8Array

interface SyncHash {
  update(input: HashInput, inputEncoding?: BufferEncoding): SyncHash
  /** 文字コードを渡せば文字列、省けば Buffer（Node と同じ） */
  digest(outputEncoding?: BufferEncoding): Buffer | string
}

export const randomUUID = (): string => globalThis.crypto.randomUUID()

export const randomBytes = (size: number): Buffer => {
  const bytes = Buffer.alloc(size)
  globalThis.crypto.getRandomValues(bytes)
  return bytes
}

export const webcrypto = globalThis.crypto

export function createHash(algorithm: string): SyncHash {
  if (algorithm.toLowerCase() !== "sha256") {
    throw new Error(
      `[web] crypto.createHash("${algorithm}") は web 版では未対応（sha256 のみ）`
    )
  }
  const hasher = sha256.create()
  const hash: SyncHash = {
    update(input, inputEncoding) {
      hasher.update(
        typeof input === "string" ? Buffer.from(input, inputEncoding) : input
      )
      return hash
    },
    digest(outputEncoding) {
      const digestBytes = Buffer.from(hasher.digest())
      return outputEncoding === undefined
        ? digestBytes
        : digestBytes.toString(outputEncoding)
    },
  }
  return hash
}

/** default で読む第三者のライブラリ（bcryptjs の `import nodeCrypto from "crypto"`）向け */
const cryptoModule = {
  randomUUID,
  randomBytes,
  webcrypto,
  createHash,
}

export default cryptoModule
