/**
 * `serializePrisma` が何を変換し、何を素通しするかを固定する。
 *
 * このシリアライザは IPC の境界で全チャンネルの戻り値に掛かる予定のため
 * （docs/ipc-and-data-fetching-plan.md 段階2）、素通しの対象を取りこぼすと
 * 全経路が壊れる。特にバイナリは、素通ししないと添字ごとのプロパティへ
 * 展開されて巨大なオブジェクトになる。
 */

import { Prisma } from "@prisma/client"
import { describe, expect, it } from "vitest"

import { serializePrisma } from "../../../electron-src/lib/prisma/serializePrisma"

describe("serializePrisma", () => {
  it("Decimal を number へ倒す", () => {
    const serialized = serializePrisma({
      partialScore: new Prisma.Decimal(2.5),
    })

    expect(serialized.partialScore).toBe(2.5)
    expect(typeof serialized.partialScore).toBe("number")
  })

  it("Date は Date のまま返す", () => {
    const updatedAt = new Date("2026-08-11T00:00:00.000Z")
    const serialized = serializePrisma({ updatedAt })

    expect(serialized.updatedAt).toBeInstanceOf(Date)
    expect(serialized.updatedAt.getTime()).toBe(updatedAt.getTime())
  })

  it("Uint8Array を添字のオブジェクトへ展開しない", () => {
    const imageData = new Uint8Array([137, 80, 78, 71])
    const serialized = serializePrisma({ imageData })

    expect(serialized.imageData).toBeInstanceOf(Uint8Array)
    expect(Array.from(serialized.imageData)).toEqual([137, 80, 78, 71])
  })

  it("Buffer を添字のオブジェクトへ展開しない", () => {
    const pdfBytes = Buffer.from([37, 80, 68, 70])
    const serialized = serializePrisma({ pdfBytes })

    expect(ArrayBuffer.isView(serialized.pdfBytes)).toBe(true)
    expect(Array.from(serialized.pdfBytes)).toEqual([37, 80, 68, 70])
  })

  it("ArrayBuffer を添字のオブジェクトへ展開しない", () => {
    const buffer = new Uint8Array([1, 2, 3]).buffer
    const serialized = serializePrisma({ buffer })

    expect(serialized.buffer).toBeInstanceOf(ArrayBuffer)
    expect(serialized.buffer.byteLength).toBe(3)
  })

  it("入れ子と配列の中まで変換する", () => {
    const serialized = serializePrisma({
      scores: [{ partialScore: new Prisma.Decimal(1.5) }],
      nested: { image: new Uint8Array([9]) },
    })

    expect(serialized.scores[0].partialScore).toBe(1.5)
    expect(serialized.nested.image).toBeInstanceOf(Uint8Array)
  })

  it("undefined のプロパティは落とす", () => {
    const serialized = serializePrisma({ kept: 1, dropped: undefined })

    expect("dropped" in serialized).toBe(false)
    expect(serialized.kept).toBe(1)
  })
})
