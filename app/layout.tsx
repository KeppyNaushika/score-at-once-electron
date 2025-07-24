import AppShell from "@/components/layout/AppShell"
import { AuthProvider } from "@/contexts/AuthContext"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "一括採点",
  description: "複数教員対応型採点アプリケーション",
  icons: {
    icon: "/一括採点アイコン.png",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <body className={inter.className}>
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  )
}
