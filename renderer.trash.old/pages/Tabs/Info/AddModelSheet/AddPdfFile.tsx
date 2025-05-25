import React, { useState } from "react"
import { Document, Page, pdfjs } from "react-pdf"
import { type OnDocumentLoadSuccess } from "react-pdf/dist/cjs/shared/types" // More specific import
import "react-pdf/dist/esm/Page/AnnotationLayer.css"
import "react-pdf/dist/esm/Page/TextLayer.css"

// Set up worker
// Make sure the worker is copied to your public/static folder or accessible via URL
// You might need to adjust the path depending on your project structure and bundler.
// For Next.js, placing it in `public` and referencing it directly might work,
// or using `new URL` if your bundler supports it.
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`

export interface AddPdfFileProps {
  setFile: React.Dispatch<React.SetStateAction<File | null>>
  setNumPages: React.Dispatch<React.SetStateAction<number | null>>
  setPageImages: React.Dispatch<React.SetStateAction<string[]>>
  setThumbnails: React.Dispatch<React.SetStateAction<string[]>>
  setPageSize: React.Dispatch<
    React.SetStateAction<{ width: number; height: number }[]>
  >
  setModelSheets: React.Dispatch<React.SetStateAction<string[]>> // Added this prop
}

const AddPdfFile = (props: AddPdfFileProps) => {
  const [numPages, setNumPages] = useState<number | null>(null)
  const [file, setFile] = useState<File | null>(null)

  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const { files } = event.target
    if (files && files[0]) {
      setFile(files[0])
      props.setFile(files[0]) // Propagate to parent
    }
  }

  const onDocumentLoadSuccess: OnDocumentLoadSuccess = async (pdf) => {
    props.setNumPages(pdf.numPages)
    const newPageImages: string[] = []
    const newThumbnails: string[] = []
    const newPageSizes: { width: number; height: number }[] = []

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const viewport = page.getViewport({ scale: 1.5 }) // For higher quality images
      const canvas = document.createElement("canvas")
      const context = canvas.getContext("2d")
      canvas.height = viewport.height
      canvas.width = viewport.width
      newPageSizes.push({ width: viewport.width, height: viewport.height })

      if (context) {
        await page.render({ canvasContext: context, viewport }).promise
        newPageImages.push(canvas.toDataURL("image/png")) // Store as PNG

        // Create thumbnails (e.g., 150px width)
        const thumbViewport = page.getViewport({ scale: 150 / viewport.width })
        const thumbCanvas = document.createElement("canvas")
        const thumbContext = thumbCanvas.getContext("2d")
        thumbCanvas.height = thumbViewport.height
        thumbCanvas.width = thumbViewport.width
        if (thumbContext) {
          await page.render({
            canvasContext: thumbContext,
            viewport: thumbViewport,
          }).promise
          newThumbnails.push(thumbCanvas.toDataURL("image/jpeg", 0.8)) // Store as JPEG
        }
      }
    }
    props.setPageImages(newPageImages)
    props.setThumbnails(newThumbnails)
    props.setPageSize(newPageSizes)
    // Assuming setModelSheets is meant to be set with these new images/thumbnails
    // This part might need clarification on what `setModelSheets` expects
    props.setModelSheets(newThumbnails) // Or newPageImages, depending on requirement
  }

  const onDocumentLoadError = (error: any) => {
    console.error("Error loading document:", error)
  }

  return (
    <div className="flex flex-col items-center">
      <input
        type="file"
        onChange={onFileChange}
        accept="application/pdf"
        placeholder="..."
      />
      {file && (
        <div style={{ height: "500px", width: "100%", overflow: "auto" }}>
          <Document
            file={file}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
          >
            {Array.from(new Array(numPages || 0), (el, index) => (
              <Page
                key={`page_${index + 1}`}
                pageNumber={index + 1}
                renderTextLayer={false} // Disable text layer if not needed
                renderAnnotationLayer={false} // Disable annotation layer if not needed
              />
            ))}
          </Document>
        </div>
      )}
      {/* ... Thumbnails display ... */}
    </div>
  )
}
export default AddPdfFile
