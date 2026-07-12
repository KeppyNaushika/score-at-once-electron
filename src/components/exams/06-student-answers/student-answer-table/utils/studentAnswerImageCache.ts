// imagePath → 読み込み済みデータURL のキャッシュ。
// グリッドのセルで一度読み込んだ画像を、ドラッグ中の DragOverlay プレビュー（別インスタンスの
// FilePreviewCell）が即座に再利用できるようにする（再取得による灰色アイコン→画像のポップインを防ぐ）。
// 同一画像の重複 IPC 取得の削減にもなる。
const imageDataUrlCache = new Map<string, string>()

/** 既に読み込み済みなら同期でデータURLを返す（未読込は undefined） */
export function getCachedStudentAnswerImage(
  imagePath: string
): string | undefined {
  return imageDataUrlCache.get(imagePath)
}

/**
 * 答案画像の表示ソースを解決する。
 * 未保存画像（メモリ内 blob = previewUrl）を優先し、無ければ DB 保存済みの imagePath を
 * Base64 データURLとして遅延読み込みする（キャッシュ対応）。
 */
export async function loadStudentAnswerImageSource(
  previewUrl: string | undefined,
  imagePath: string | null | undefined
): Promise<string> {
  // 新規ファイル（メモリ内）の場合は preview を返す
  if (previewUrl) {
    return previewUrl
  }

  if (!imagePath) {
    throw new Error("Image path not found")
  }

  const cached = imageDataUrlCache.get(imagePath)
  if (cached) {
    return cached
  }

  try {
    const result = await window.electronAPI.getImageData(imagePath)

    if (result.success && result.data) {
      imageDataUrlCache.set(imagePath, result.data)
      return result.data
    } else {
      throw new Error(result.error || "Failed to load image")
    }
  } catch (error) {
    console.error("画像読み込みエラー:", error)
    throw error
  }
}
