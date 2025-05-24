import React from "react"
import Head from "next/head"
import "./globals.css"

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <body>
        <div className="flex h-screen select-none flex-col">{children}</div>
      </body>
    </html>
  )
}
