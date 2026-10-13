/**
 * 「一括採点について」は、ログインの関門（`src/app/(app)/layout.tsx` の `AuthGate`）の外に
 * 置く、を縛る。AGPLv3 のソースの案内は、ログインの前にも辿れなければならない。
 *
 * `(app)` の下に置くと、ログインしていない人は開けずにログインのページへ回される。
 */
import * as fs from "node:fs"
import * as path from "node:path"

import { describe, expect, it } from "vitest"

const appDir = path.resolve(__dirname, "../../src/app")

describe("一括採点について", () => {
  it("ログインの関門の外（src/app/about）にある", () => {
    expect(fs.existsSync(path.join(appDir, "about", "page.tsx"))).toBe(true)
    expect(fs.existsSync(path.join(appDir, "(app)", "about"))).toBe(false)
  })
})
