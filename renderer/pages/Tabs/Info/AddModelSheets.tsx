import React, { Dispatch, SetStateAction, useState } from "react"
import AddPdfFile from "./AddModelSheet/AddPdfFile" // Assuming AddPdfFile is in this path
import AddPictureFiles from "./AddModelSheet/AddPictureFiles"

interface AddModelSheetsProps {
  modelSheets: string[]
  setModelSheets: Dispatch<SetStateAction<string[]>>
}

const AddModelSheets: React.FC<AddModelSheetsProps> = ({
  modelSheets,
  setModelSheets,
}) => {
  // Props required by AddPdfFile
  const [file, setFile] = useState<File | null>(null)
  const [numPages, setNumPages] = useState<number | null>(null)
  const [pageImages, setPageImages] = useState<string[]>([])
  const [thumbnails, setThumbnails] = useState<string[]>([])
  const [pageSize, setPageSize] = useState<{ width: number; height: number }[]>(
    [],
  )

  return (
    <div className="pb-2 pr-2">
      <div className="flex h-40 w-28 flex-col items-center justify-around rounded-sm border-2 border-gray-200 text-gray-500">
        <AddPictureFiles setModelSheets={setModelSheets} />
        <div className="w-20 rounded-full border-t-2 border-gray-200"></div>
        <AddPdfFile
          setFile={setFile}
          setNumPages={setNumPages}
          setPageImages={setPageImages}
          setThumbnails={setThumbnails}
          setPageSize={setPageSize}
          setModelSheets={setModelSheets} // This prop is now correctly passed
        />
      </div>
    </div>
  )
}

export default AddModelSheets
