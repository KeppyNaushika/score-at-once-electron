/**
 * ZIP の項目の CRC-32（統合アーカイブの書き手 `archiveZipWriter.ts` と読み手
 * `archiveZipReader.ts` が使う。fflate は CRC を外へ出さないので、ここで持つ）
 */

const CRC32_TABLE = Uint32Array.from({ length: 256 }, (_unused, tableIndex) =>
  Array.from({ length: 8 }).reduce<number>(
    (crc) => (crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1),
    tableIndex
  )
)

export function crc32Of(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}
