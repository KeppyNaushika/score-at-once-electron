"use client"

import React, { useRef, useEffect } from "react"

interface SpreadsheetColumn {
  title: string
  width: number
}

interface SpreadsheetEditorProps {
  columns: SpreadsheetColumn[]
  initialData: any[][]
  onChange: () => void
  onInitialized?: () => void
  minDimensions?: [number, number]
  className?: string
  style?: React.CSSProperties
}

export default function SpreadsheetEditor({
  columns,
  initialData,
  onChange,
  onInitialized,
  minDimensions = [columns.length, 10],
  className = "border rounded-md min-h-[300px] overflow-auto",
  style = { fontSize: '13px' }
}: SpreadsheetEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  const initializeSpreadsheet = async () => {
    try {
      // Load dependencies
      const jsuites = await import('jsuites')
      const jspreadsheet = await import('jspreadsheet-ce')
      
      // Make jsuites available globally
      if (typeof window !== 'undefined') {
        (window as any).jSuites = jsuites.default || jsuites;
        (window as any).jsuites = jsuites.default || jsuites;
      }
      
      // Load stylesheets if not already present
      if (!document.querySelector('link[href*="jspreadsheet"]')) {
        const link = document.createElement('link')
        link.rel = 'stylesheet'
        link.href = 'https://cdn.jsdelivr.net/npm/jspreadsheet-ce@4/dist/jspreadsheet.css'
        document.head.appendChild(link)
      }
      
      if (!document.querySelector('link[href*="jsuites"]')) {
        const link = document.createElement('link')
        link.rel = 'stylesheet' 
        link.href = 'https://cdn.jsdelivr.net/npm/jsuites@4/dist/jsuites.css'
        document.head.appendChild(link)
      }

      // Wait for styles to load
      await new Promise(resolve => setTimeout(resolve, 100))

      if (containerRef.current) {
        containerRef.current.innerHTML = ''

        const instance = (jspreadsheet.default || jspreadsheet)(containerRef.current, {
          data: initialData,
          columns,
          onchange: onChange,
          allowInsertRow: true,
          allowDeleteRow: true,
          allowRenameColumn: false,
          columnSorting: false,
          csvHeaders: true,
          parseFormulas: false,
          minDimensions,
        } as any)

        onInitialized?.()
      }
    } catch (error) {
      console.error('Failed to initialize spreadsheet:', error)
      // Fallback to simple display
      if (containerRef.current) {
        containerRef.current.innerHTML = `
          <div class="border rounded-lg overflow-hidden">
            <div class="bg-muted p-4 text-center">
              <p class="text-sm text-muted-foreground">
                スプレッドシート機能が利用できません。<br>
                手動でデータを入力してください。
              </p>
            </div>
          </div>
        `
      }
    }
  }

  useEffect(() => {
    initializeSpreadsheet()
  }, [])

  return (
    <div 
      ref={containerRef} 
      className={className}
      style={style}
    />
  )
}