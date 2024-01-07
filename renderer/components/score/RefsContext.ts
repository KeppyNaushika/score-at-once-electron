import React from "react"

const RefsContext = React.createContext<React.MutableRefObject<
  Array<HTMLDivElement | null>
> | null>(null)

export default RefsContext
