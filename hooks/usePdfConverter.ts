"use client"

import { useCallback } from "react"
import * as pdfjsLib from 'pdfjs-dist'

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`

export interface ConvertedImage {
  name: string
  type: string
  buffer: ArrayBuffer
}

export interface PdfConversionError {
  type: 'password-required' | 'invalid-password' | 'general-error'
  message: string
}

export function usePdfConverter() {
  const convertPdfToImages = useCallback(async (file: File, password?: string): Promise<ConvertedImage[]> => {
    try {
      const arrayBuffer = await file.arrayBuffer()
      const loadingTask = pdfjsLib.getDocument({
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
      if (error.name === 'PasswordException') {
        throw new Error('password-required')
      } else if (error.name === 'InvalidPDFException' && password) {
        throw new Error('invalid-password')
      } else {
        throw new Error(`PDF変換エラー: ${error.message || '不明なエラー'}`)
      }
    }
  }, [])

  return {
    convertPdfToImages
  }
}