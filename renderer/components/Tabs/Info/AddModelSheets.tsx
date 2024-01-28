import React from "react"
import AddPictureFiles from "./AddModelSheet/AddPictureFiles"
import AddPdfFile from "./AddModelSheet/AddPdfFile"

const AddModelSheets = (props: {
  setModelSheets: React.Dispatch<React.SetStateAction<string[]>>
}): JSX.Element => {
  const { setModelSheets } = props

  return (
    <div className="pb-2 pr-2">
      <div className="flex h-40 w-28 flex-col items-center justify-around rounded-sm border-2 border-gray-200 text-gray-500">
        <AddPictureFiles setModelSheets={setModelSheets} />
        <div className="w-20 rounded-full border-t-2 border-gray-200"></div>
        <AddPdfFile setModelSheets={setModelSheets} />
      </div>
    </div>
  )
}
export default AddModelSheets
