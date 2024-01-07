import { LibraryAddOutlined } from "@mui/icons-material"
import { Document, Page, pdfjs } from "react-pdf"
import React, { useRef, type ChangeEvent, useState } from "react"
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.js`

const AddPdfFile = (props: {
  setModelSheets: React.Dispatch<React.SetStateAction<string[]>>
}): JSX.Element => {
  const { setModelSheets } = props

  const fileInputRef = useRef<HTMLInputElement>(null)
  const handleClick = (): void => {
    fileInputRef.current?.click()
  }
  const handleFileInput = (e: ChangeEvent<HTMLInputElement>): void => {
    if (e.target.files !== null) {
      const file = e.target.files[0]
      if (file.type.match("application/pdf") != null) {
        setSelectedFile(file)
      }
    }
  }

  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  interface PdfViewerProps {
    file: File // PDF ファイルへのパス
  }

  const [numPages, setNumPages] = useState<number | null>(null)

  const [beginPage, setBeginPage] = useState<number | null>(null)
  const [endPage, setEndPage] = useState<number | null>(null)
  const [skipPage, setSkipPage] = useState<number | null>(null)
  const PdfViewer: React.FC<PdfViewerProps> = ({ file }) => {
    const onDocumentLoadSuccess = ({
      numPages,
    }: {
      numPages: number
    }): void => {
      setBeginPage(1)
      setEndPage(numPages)
      setSkipPage(1)
      setNumPages(numPages)
    }

    const pages: JSX.Element[] = []
    if (beginPage !== null && endPage !== null && skipPage !== null) {
      let index = beginPage
      for (let i = 0; i < 6; i++) {
        if (index > endPage) {
          break
        }
        pages.push(
          <div className="m-2 border-2" key={i}>
            <Page
              pageNumber={index}
              renderTextLayer={false}
              renderAnnotationLayer={false}
              width={300}
            />
          </div>,
        )
        index += skipPage
      }
    }
    return (
      <div className="flex justify-center">
        <Document
          file={file}
          onLoadSuccess={onDocumentLoadSuccess}
          className="flex flex-wrap justify-center"
        >
          {pages}
        </Document>
      </div>
    )
  }

  return (
    <>
      {selectedFile !== null && (
        <div className="absolute inset-0 z-20 flex min-h-full min-w-full flex-col items-center justify-between bg-white/80 p-20">
          <div className="flex justify-center border-y-2 border-gray-200">
            <div className="flex">
              <div className="py-2">開始：</div>
              <input
                className="w-12 py-2 text-center placeholder:opacity-0 focus:outline-none"
                type="number"
                placeholder="開始ページ"
                value={beginPage?.toString()}
                onChange={(e) => {
                  const value = Number(e.target.value)
                  if (!Number.isNaN(value)) {
                    setBeginPage(value)
                  }
                }}
                min={1}
                max={numPages?.toString() ?? 0}
              />
            </div>
            <div className="mx-10 my-2 border-l-2 border-gray-200"></div>
            <div className="flex">
              <div className="py-2">終了：</div>
              <input
                className="w-12 py-2 text-center placeholder:opacity-0 focus:outline-none"
                type="number"
                placeholder="終了ページ"
                value={endPage?.toString()}
                onChange={(e) => {
                  const value = Number(e.target.value)
                  if (!Number.isNaN(value)) {
                    setEndPage(value)
                  }
                }}
                min={1}
                max={numPages?.toString() ?? 0}
              />
            </div>
            <div className="mx-10 my-2 border-l-2 border-gray-200"></div>
            <div className="flex">
              <div className="py-2">スキップ：</div>
              <input
                className="w-12 py-2 text-center placeholder:opacity-0 focus:outline-none"
                type="number"
                placeholder="スキップ"
                defaultValue={1}
                min={1}
                max={numPages?.toString() ?? 0}
              />
            </div>
            <div className="mx-10 my-2 border-l-2 border-gray-200"></div>
            <div className="flex">
              <div className="py-2">逆順</div>
              <select
                title="逆順"
                className="w-20 py-2 text-center placeholder:opacity-0 focus:outline-none"
              >
                <option value="false">オフ</option>
                <option value="true">オン</option>
              </select>
            </div>
          </div>
          <PdfViewer file={selectedFile} />
          <div className="flex py-4">
            <div className="flex h-16 w-40 flex-col items-center justify-center rounded-md bg-emerald-500 text-white">
              <div className="">上の画像を</div>
              <div className="">読み込む</div>
            </div>
            <div className="w-20"></div>
            <div
              className="flex h-16 w-40 items-center justify-center rounded-md bg-gray-300"
              onClick={() => {
                setSelectedFile(null)
              }}
            >
              戻る
            </div>
          </div>
        </div>
      )}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInput}
        style={{ display: "none" }}
        accept="application/pdf"
        placeholder="."
      />
      <div
        className="flex h-1/2 cursor-pointer flex-col items-center justify-center"
        onClick={handleClick}
      >
        <LibraryAddOutlined />
        <div className="pt-2 text-xs">PDF</div>
      </div>
    </>
  )
}

export default AddPdfFile
