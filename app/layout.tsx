import "./globals.css"

import type { Metadata } from "next"
import { Inter } from "next/font/google"

import AppShell from "@/components/layout/AppShell"
import { AuthProvider } from "@/contexts/AuthContext"
import { NavigationGuardProvider } from "@/contexts/NavigationGuardContext"

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
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.MathJax = {
                tex: {
                  inlineMath: [['$', '$'], ['\\\\(', '\\\\)']],
                  displayMath: [['$$', '$$'], ['\\\\[', '\\\\]']],
                  processEscapes: true,
                  processEnvironments: true,
                  packages: {'[+]': ['base', 'ams', 'newcommand']}
                },
                svg: {
                  fontCache: 'global',
                  scale: 1.0,
                  minScale: 0.5,
                  mtextInheritFont: false,
                  merrorInheritFont: true,
                  mathmlSpacing: false,
                  skipAttributes: {},
                  exFactor: 0.5,
                  displayAlign: 'left',
                  displayIndent: '0'
                },
                chtml: {
                  scale: 1.0,
                  minScale: 0.5,
                  mtextInheritFont: false,
                  merrorInheritFont: true,
                  matchFontHeight: false,
                  fontURL: '/js/mathjax/output/chtml/fonts/woff-v2'
                },
                options: {
                  skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre'],
                  ignoreHtmlClass: 'no-mathjax',
                  processHtmlClass: 'mathjax'
                },
                loader: {
                  // ローカル環境用のローダー設定を最小限に
                  source: {},
                  dependencies: {},
                  provides: {},
                  failed: () => console.warn('MathJax loader failed'),
                  require: (url) => console.log('MathJax require:', url)
                },
                startup: {
                  ready: () => {
                    console.log('🔥 MathJax 4 initialized successfully (Offline Mode)');

                    // デフォルトの初期化を実行
                    MathJax.startup.defaultReady();
                  }
                }
              };
            `,
          }}
        />
        <script id="MathJax-script" async src="/js/mathjax/tex-svg.js" />
      </head>
      <body className={inter.className}>
        <AuthProvider>
          <NavigationGuardProvider>
            <AppShell>{children}</AppShell>
          </NavigationGuardProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
