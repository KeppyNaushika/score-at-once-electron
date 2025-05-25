import React from "react"
import PropTypes from "prop-types"

import { M_PLUS_1p } from "next/font/google"

const inter = M_PLUS_1p({ weight: "400", subsets: ["latin"] })

const MyApp = ({ Component, pageProps }) => {
  return (
    <main className={inter.className}>
      <Component {...pageProps} />
    </main>
  )
}

MyApp.propTypes = {
  Component: PropTypes.elementType.isRequired,
  pageProps: PropTypes.object,
}

export default MyApp
