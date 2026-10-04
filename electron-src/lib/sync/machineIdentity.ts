/**
 * このPCの身元（clientId の持ち主の見分け）
 *
 * clientId は data の設定に置くので、data を丸ごと別のPCへ写すと一緒に写る。
 * 写った先で「このPCが振った clientId か」を見分けるために、**data と一緒には写らない**
 * 2つの値を組にして使う。
 *
 * - `installationId`: userData に置く uuidv4。アプリの更新で data を写しても、同じPC・
 *   同じ OS の利用者なら userData は同じなので変わらない
 * - `hostname`: OS のホスト名。Windows の移動プロファイルで userData ごと別のPCへ
 *   渡っても、ホスト名は PC ごとに違う
 *
 * どちらかが違えば別のPCとみなして振り直す。同じPCで誤って振り直しても
 * （userData を消した・ホスト名を変えた）、古い写しが更新されないクライアントとして
 * 共有フォルダに残るだけで、データは失われない。
 */

import * as crypto from "crypto"
import { app } from "electron"
import * as fs from "fs"
import * as os from "os"
import * as path from "path"

import type { ClientIdOwner } from "./types"

/** userData に置く、このPCの id のファイル名 */
const INSTALLATION_ID_FILE_NAME = "installation-id"

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * userData の installation id を読む。無ければ作る。
 *
 * 書けなかったときは、この起動だけの id を返す（次の起動で clientId が振り直される
 * だけで、データは失われない）。
 */
function loadOrCreateInstallationId(userDataDirectory: string): string {
  const idPath = path.join(userDataDirectory, INSTALLATION_ID_FILE_NAME)
  try {
    if (fs.existsSync(idPath)) {
      const stored = fs.readFileSync(idPath, "utf-8").trim()
      if (UUID_V4_PATTERN.test(stored)) return stored
    }
  } catch (error) {
    console.warn(`Failed to read installation id: ${idPath}`, error)
  }
  const created = crypto.randomUUID()
  try {
    fs.mkdirSync(userDataDirectory, { recursive: true })
    fs.writeFileSync(idPath, created, "utf-8")
  } catch (error) {
    console.warn(`Failed to save installation id: ${idPath}`, error)
  }
  return created
}

/** このPCの身元 */
export function getCurrentClientIdOwner(
  userDataDirectory: string = app.getPath("userData")
): ClientIdOwner {
  return {
    installationId: loadOrCreateInstallationId(userDataDirectory),
    hostname: os.hostname(),
  }
}
