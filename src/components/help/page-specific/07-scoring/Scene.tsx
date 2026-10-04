/**
 * 各セクションのブロック。一般的なヘルプページのように、上から下へ
 * 自然にスクロールして読み進められるよう、適度な余白だけを与える。
 */
export function Scene({
  children,
  sceneRef,
}: {
  children: React.ReactNode
  sceneRef?: React.Ref<HTMLDivElement>
}) {
  return (
    <section ref={sceneRef} className="scroll-mt-8 pb-20 last:pb-4 sm:pb-28">
      {children}
    </section>
  )
}
