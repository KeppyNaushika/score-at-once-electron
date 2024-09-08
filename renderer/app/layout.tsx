import React from "react"
import Head from "next/head"
import Tabs from "./Tabs"

import "./globals.css"

const title = "This is the default title"

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <Head>
        <title>{title}</title>
        <meta charSet="utf-8" />
        <meta name="viewport" content="initial-scale=1.0, width=device-width" />
      </Head>
      <body>
        <main>
          <Tabs />
          <div className="flex h-screen select-none flex-col">{children}</div>
        </main>
      </body>
    </html>
  )
}
