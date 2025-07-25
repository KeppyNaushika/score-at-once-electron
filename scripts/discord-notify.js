const https = require('https');
const url = require('url');

/**
 * Discord Webhookにメッセージを送信
 * @param {string} webhookUrl Discord Webhook URL
 * @param {object} payload 送信するペイロード
 */
async function sendDiscordNotification(webhookUrl, payload) {
  return new Promise((resolve, reject) => {
    const parsedUrl = url.parse(webhookUrl);
    
    const postData = JSON.stringify(payload);
    
    const options = {
      hostname: parsedUrl.hostname,
      port: 443,
      path: parsedUrl.path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data);
        } else {
          reject(new Error(`Discord API error: ${res.statusCode} ${data}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

/**
 * リリース通知用のDiscordメッセージを生成
 * @param {string} version バージョン
 * @param {string} releaseUrl GitHub Release URL
 * @param {boolean} isPrerelease プレリリースかどうか
 */
function createReleaseMessage(version, releaseUrl, isPrerelease = false) {
  const packageJson = require('../package.json');
  
  const releaseType = isPrerelease ? 'プレリリース' : '正式版';
  const color = isPrerelease ? 0xFFA500 : 0x00FF00; // オレンジ or 緑
  
  // 説明文を動的に生成
  let description = packageJson.description || '複数教員による協調採点システム';
  description += '\n\n';
  description += `**[📥 ダウンロード](${releaseUrl})**`;
  description += '\n';
  description += 'ダウンロードしたら :try: 押して下さい';
  
  // プレリリース専用の追加メッセージ
  if (isPrerelease) {
    description += '\n\n⚠️ **プレリリース版です。ライセンスをご確認下さい。**';
  }
  
  return {
    embeds: [{
      title: `🚀 一括採点 ${version} ${releaseType}がリリースされました！`,
      description: description,
      color: color,
      fields: [
        {
          name: '📦 バージョン',
          value: version,
          inline: true
        }
      ],
      footer: {
        text: 'KeppyNaushika',
        icon_url: 'https://github.com/KeppyNaushika.png'
      },
      timestamp: new Date().toISOString()
    }]
  };
}

/**
 * リリース通知をDiscordに送信
 * @param {string} version バージョン
 * @param {string} releaseUrl GitHub Release URL  
 * @param {boolean} isPrerelease プレリリースかどうか
 */
async function notifyRelease(version, releaseUrl, isPrerelease = false) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  
  if (!webhookUrl) {
    console.log('⚠️ DISCORD_WEBHOOK_URL環境変数が設定されていません。Discord通知をスキップします。');
    return;
  }

  try {
    console.log('📨 Discord通知を送信中...');
    
    const message = createReleaseMessage(version, releaseUrl, isPrerelease);
    await sendDiscordNotification(webhookUrl, message);
    
    console.log('✅ Discord通知が正常に送信されました！');
  } catch (error) {
    console.error('❌ Discord通知の送信に失敗しました:', error.message);
    // 通知の失敗でリリース処理を止めない
  }
}

module.exports = {
  sendDiscordNotification,
  createReleaseMessage,
  notifyRelease
};