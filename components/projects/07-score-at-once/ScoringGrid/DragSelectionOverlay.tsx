interface DragSelectionOverlayProps {
  rect: {
    left: number
    top: number
    width: number
    height: number
  }
}

export function DragSelectionOverlay({ rect }: DragSelectionOverlayProps) {
  return (
    <div
      className="pointer-events-none absolute"
      style={{
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        backgroundColor: "rgba(59, 130, 246, 0.2)", // 透過した青色
        border: "2px solid rgba(59, 130, 246, 0.5)",
        borderRadius: "4px",
        zIndex: 1000,
      }}
    />
  )
}