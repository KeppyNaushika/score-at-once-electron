/**
 * 事業者の SDK へ渡す fetch。Electron の `net.fetch` を包む。
 *
 * Node の fetch は OS のプロキシ設定を見ないので、学校のプロキシの内側では通らない。
 * `net.fetch` は Chromium のネットワーク層を通り、OS のプロキシ設定に従う。
 * `net.fetch` は URL オブジェクトを受け取らないので、文字列へ直して渡す。
 */

import { net } from "electron"

import type { ProviderFetch } from "./providers/types"

export const electronFetch: ProviderFetch = (input, init) =>
  net.fetch(input instanceof URL ? input.href : input, init)
