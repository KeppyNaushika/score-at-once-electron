/**
 * 採点担当idの決定論的生成のテスト
 *
 * `@default(uuid())` に任せると、2端末が同じ (設問, 担当者) ペアを割り当てたときに
 * id違い・`@@unique` 同値の行ができてNAS同期で衝突する。同一idに収束することが
 * この機構の全てなので、性質をテストで固定する。
 */
import { describe, expect, it } from "vitest"

import { buildAssignmentId } from "@/electron-src/lib/prisma/cropRegionAssignment"

const CROP_REGION_A = "6b1f2b62-1f7f-4f1e-9a3d-0c9a1b2c3d4e"
const CROP_REGION_B = "7c2f3c73-2f8f-4f2e-8b4e-1d0b2c3d4e5f"
const USER_A = "11111111-2222-3333-4444-555555555555"
const USER_B = "66666666-7777-8888-9999-000000000000"

describe("buildAssignmentId", () => {
  it("同じ (設問, 担当者) ペアは常に同じidになる", () => {
    expect(buildAssignmentId(CROP_REGION_A, USER_A)).toBe(
      buildAssignmentId(CROP_REGION_A, USER_A)
    )
  })

  it("設問が違えば別のidになる", () => {
    expect(buildAssignmentId(CROP_REGION_A, USER_A)).not.toBe(
      buildAssignmentId(CROP_REGION_B, USER_A)
    )
  })

  it("担当者が違えば別のidになる", () => {
    expect(buildAssignmentId(CROP_REGION_A, USER_A)).not.toBe(
      buildAssignmentId(CROP_REGION_A, USER_B)
    )
  })

  it("区切りをまたぐ連結の取り違えが起きない", () => {
    // "ab" + "c" と "a" + "bc" が同じハッシュ入力にならないこと
    expect(buildAssignmentId("ab", "c")).not.toBe(buildAssignmentId("a", "bc"))
  })

  it("RFC 4122 v5 の書式（version 5・variant RFC 4122）になる", () => {
    const id = buildAssignmentId(CROP_REGION_A, USER_A)
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    )
  })
})
