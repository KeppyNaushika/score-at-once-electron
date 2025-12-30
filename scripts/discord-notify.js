import dotenv from "dotenv"
import { request } from "https"
dotenv.config()

/**
 * Discord Webhookにメッセージを送信
 * @param {string} webhookUrl Discord Webhook URL
 * @param {object} payload 送信するペイロード
 * @returns {Promise<object>} レスポンスデータ（メッセージ情報を含む）
 */
async function sendDiscordNotification(webhookUrl, payload) {
  return new Promise((resolve, reject) => {
    const url = new URL(webhookUrl)

    // wait=trueパラメータを追加してメッセージ情報を取得
    const pathWithWait = url.pathname + "?wait=true"

    const postData = JSON.stringify(payload)

    const options = {
      hostname: url.hostname,
      port: 443,
      path: pathWithWait,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(postData),
      },
    }

    const req = request(options, (res) => {
      let data = ""

      res.on("data", (chunk) => {
        data += chunk
      })

      res.on("end", () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const messageData = JSON.parse(data)
            resolve(messageData)
          } catch {
            resolve(data)
          }
        } else {
          reject(new Error(`Discord API error: ${res.statusCode} ${data}`))
        }
      })
    })

    req.on("error", (error) => {
      reject(error)
    })

    req.write(postData)
    req.end()
  })
}

/**
 * Discord Webhookメッセージにリアクションを追加
 * @param {string} webhookUrl Discord Webhook URL
 * @param {string} messageId メッセージID
 * @param {string} emoji 追加する絵文字
 */
async function addReactionToWebhookMessage(webhookUrl, messageId, emoji) {
  return new Promise((resolve, reject) => {
    // Webhook URLからトークンとIDを抽出
    const match = webhookUrl.match(/webhooks\/(\d+)\/([a-zA-Z0-9_-]+)/)
    if (!match) {
      reject(new Error("Invalid webhook URL format"))
      return
    }

    const [, webhookId, webhookToken] = match

    // 絵文字をURLエンコード
    const encodedEmoji = encodeURIComponent(emoji)
    const reactionPath = `/api/webhooks/${webhookId}/${webhookToken}/messages/${messageId}/reactions/${encodedEmoji}/@me`

    const options = {
      hostname: "discord.com",
      port: 443,
      path: reactionPath,
      method: "PUT",
      headers: {
        "Content-Length": 0,
      },
    }

    const req = request(options, (res) => {
      let data = ""

      res.on("data", (chunk) => {
        data += chunk
      })

      res.on("end", () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data)
        } else {
          reject(
            new Error(`Discord reaction API error: ${res.statusCode} ${data}`),
          )
        }
      })
    })

    req.on("error", (error) => {
      reject(error)
    })

    req.end()
  })
}

/**
 * 最近のコミット履歴からPR情報を取得
 * @param {string} previousVersion 前回のバージョンタグ
 * @returns {string[]} PR情報のリスト
 */
function getRecentPRs(previousVersion) {
  try {
    const { execSync } = require("child_process")

    // 前回バージョンから現在までのコミット履歴を取得
    let gitLogCommand
    if (previousVersion) {
      gitLogCommand = `git log ${previousVersion}..HEAD --oneline --grep="Merge pull request" -n 10`
    } else {
      gitLogCommand = `git log --oneline --grep="Merge pull request" -n 10`
    }

    const gitLog = execSync(gitLogCommand, {
      encoding: "utf-8",
      stdio: "pipe",
    }).trim()

    if (!gitLog) return []

    // PRコミットから情報を抽出
    return gitLog
      .split("\n")
      .map((line) => {
        // "a1b2c3d Merge pull request #123 from user/feature-branch" から "#123" と説明を抽出
        const prMatch = line.match(/Merge pull request (#\d+) from .+?\/(.+)/)
        if (prMatch) {
          const [, prNumber, branchName] = prMatch
          return `${prNumber}: ${branchName.replace(/-/g, " ")}`
        }
        return null
      })
      .filter(Boolean)
      .slice(0, 5) // 最大5個まで
  } catch (error) {
    console.warn("PR情報の取得に失敗:", error.message)
    return []
  }
}

/**
 * 前回のバージョンタグを取得
 * @param {string} currentVersion 現在のバージョン
 * @returns {string|null} 前回のバージョンタグ
 */
function getPreviousVersion(currentVersion) {
  try {
    const { execSync } = require("child_process")

    // すべてのタグを取得し、バージョン順でソート
    const tags = execSync("git tag -l 'v*' --sort=-version:refname", {
      encoding: "utf-8",
      stdio: "pipe",
    })
      .trim()
      .split("\n")
      .filter(Boolean)

    // 現在のバージョンタグを除外して最新のものを取得
    const currentTag = `v${currentVersion}`
    const previousTag = tags.find((tag) => tag !== currentTag)

    return previousTag || null
  } catch (error) {
    console.warn("前回バージョンの取得に失敗:", error.message)
    return null
  }
}

/**
 * リリース通知用のDiscordメッセージを生成
 * @param {string} version バージョン
 * @param {string} releaseUrl GitHub Release URL
 * @param {boolean} isPrerelease プレリリースかどうか
 */
function createReleaseMessage(version, releaseUrl, isPrerelease = false) {
  const packageJson = require("../package.json")

  const _releaseType = isPrerelease ? "プレリリース" : "正式版"
  const color = isPrerelease ? 0xffa500 : 0x00ff00 // オレンジ or 緑

  // 説明文を動的に生成
  let description =
    packageJson.description ||
    "完全無料・インストール不要・オフライン完結の採点支援ソフト"
  description += "\n\n"
  description += `**[📥 ダウンロード](${releaseUrl})**`
  description += "\n"
  description += "ダウンロードしたら :try: を押して下さい"

  // プレリリース専用の追加メッセージ
  if (isPrerelease) {
    description += "\n\n⚠️ **プレリリース版です。ライセンスをご確認下さい。**"
  }

  // 最近のPR情報を取得
  const previousVersion = getPreviousVersion(version)
  const recentPRs = getRecentPRs(previousVersion)

  // フィールドを動的に生成
  const fields = [
    {
      name: "📦 バージョン",
      value: version,
      inline: true,
    },
  ]

  // PR情報があれば追加
  if (recentPRs.length > 0) {
    fields.push({
      name: "✨ このバージョンの新機能・改善",
      value: recentPRs
        .map((pr) => `• ${pr.replace(/^#\d+:\s*/, "")}`)
        .join("\n"),
      inline: false,
    })
  }

  return {
    content: "@everyone", // 全メンバーに通知
    embeds: [
      {
        title: `:app_icon: 一括採点 ${version} をリリースしました！`,
        description: description,
        color: color,
        fields: fields,
        footer: {
          text: "KeppyNaushika",
          icon_url: "https://github.com/KeppyNaushika.png",
        },
        timestamp: new Date().toISOString(),
      },
    ],
  }
}

/**
 * リリース通知をDiscordに送信
 * @param {string} version バージョン
 * @param {string} releaseUrl GitHub Release URL
 * @param {boolean} isPrerelease プレリリースかどうか
 */
async function notifyRelease(version, releaseUrl, isPrerelease = false) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL

  if (!webhookUrl) {
    console.log(
      "⚠️ DISCORD_WEBHOOK_URL環境変数が設定されていません。Discord通知をスキップします。",
    )
    return
  }

  try {
    console.log("📨 Discord通知を送信中...")

    const message = createReleaseMessage(version, releaseUrl, isPrerelease)
    const messageData = await sendDiscordNotification(webhookUrl, message)

    console.log("✅ Discord通知が正常に送信されました！")

    // 自動で :try: リアクションを追加
    if (messageData && messageData.id) {
      console.log("😊 自動リアクションを追加中...")
      try {
        await addReactionToWebhookMessage(webhookUrl, messageData.id, "🆔")
        console.log("✅ :try: リアクションを自動追加しました！")
      } catch (reactionError) {
        console.error(
          "⚠️ リアクション追加に失敗しました:",
          reactionError.message,
        )
        // リアクション失敗は致命的ではないので続行
      }
    }
  } catch (error) {
    console.error("❌ Discord通知の送信に失敗しました:", error.message)
    // 通知の失敗でリリース処理を止めない
  }
}

const discordNotify = {
  sendDiscordNotification,
  addReactionToWebhookMessage,
  createReleaseMessage,
  notifyRelease,
}

export default discordNotify
