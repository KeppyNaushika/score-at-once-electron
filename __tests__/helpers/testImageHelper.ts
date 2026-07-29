/**
 * テスト用画像ヘルパー
 *
 * テスト用の最小PNGファイルと画像ディレクトリ構造を作成
 */

/**
 * 最小の1x1 PNGバッファを生成（68バイト固定）
 */
export function createMinimalPngBuffer(): Buffer {
  // 1x1 transparent PNG (68 bytes)
  return Buffer.from(
    "89504e470d0a1a0a0000000d4948445200000001000000010800000000" +
      "3a7e9b550000000a49444154789c626000000002000198e195280000" +
      "000049454e44ae426082",
    "hex"
  )
}
