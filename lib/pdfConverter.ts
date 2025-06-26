"use client"

export interface ConvertedImage {
  name: string
  type: string
  buffer: ArrayBuffer
}

export interface PdfConversionError {
  type: 'password-required' | 'invalid-password' | 'general-error'
  message: string
}

let pdfjsLib: any = null

// PDF.js を動的にロード
const loadPdfjs = async () => {
  if (pdfjsLib) return pdfjsLib
  
  if (typeof window === 'undefined') {
    throw new Error('PDF変換はクライアントサイドでのみ利用可能です')
  }
  
  try {
    pdfjsLib = await import('pdfjs-dist')
    // Set up PDF.js worker
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`
    return pdfjsLib
  } catch (error) {
    console.error('PDF.js のロードに失敗しました:', error)
    throw error
  }
}

export async function convertPdfToImages(file: File, password?: string): Promise<ConvertedImage[]> {
  const pdfjs = await loadPdfjs()
  
  try {
    const arrayBuffer = await file.arrayBuffer()
    const loadingTask = pdfjs.getDocument({
      data: arrayBuffer,
      password: password
    })
    const pdf = await loadingTask.promise
    const images: ConvertedImage[] = []

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum)
      const scale = 2.0 // Higher scale for better quality
      const viewport = page.getViewport({ scale })

      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')!
      canvas.height = viewport.height
      canvas.width = viewport.width

      await page.render({
        canvasContext: context,
        viewport: viewport
      }).promise

      // Convert canvas to blob with PNG for lossless quality (better for editing workflow)
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((blob) => resolve(blob!), 'image/png')
      })

      const buffer = await blob.arrayBuffer()
      const baseName = file.name.replace(/\.pdf$/i, '')
      
      images.push({
        name: `${baseName}_page_${pageNum}.png`,
        type: 'image/png',
        buffer: buffer
      })
    }

    return images
  } catch (error: any) {
    // PDF.js エラーハンドリング
    console.error('PDF変換エラー詳細:', error)
    
    if (error.name === 'PasswordException') {
      if (password) {
        // パスワードが提供されているが間違っている場合
        throw new Error('invalid-password')
      } else {
        // パスワードが必要な場合
        throw new Error('password-required')
      }
    } else if (error.name === 'InvalidPDFException') {
      throw new Error('PDF形式が無効です')
    } else if (error.message && error.message.includes('Invalid PDF')) {
      throw new Error('PDF形式が無効です')
    } else {
      throw new Error(`PDF変換エラー: ${error.message || '不明なエラー'}`)
    }
  }
}