/**
 * ZoomControls - Zoom functionality component for image canvas
 *
 * Features:
 * - Visual zoom level display
 * - Help overlay with keyboard shortcuts
 * - Zoom reset functionality
 *
 * @param zoom - Current zoom level (0.1 to 5.0)
 * @param showZoomHelp - Whether to show the help overlay
 * @param onToggleHelp - Callback to toggle help visibility
 * @returns JSX component for zoom controls
 */

interface ZoomControlsProps {
  zoom: number
  showZoomHelp: boolean
  onToggleHelp: (show: boolean) => void
}

export function ZoomControls({
  zoom,
  showZoomHelp,
  onToggleHelp,
}: ZoomControlsProps) {
  return (
    <>
      {/* ズーム操作のヘルプ表示 */}
      {showZoomHelp && (
        <div className="bg-opacity-70 absolute top-2 right-2 z-20 max-w-xs rounded bg-black p-2 text-xs text-white">
          <div className="mb-1 flex items-center justify-between">
            <span className="font-semibold">操作:</span>
            <button
              onClick={() => onToggleHelp(false)}
              className="ml-2 text-white hover:text-gray-300"
              aria-label="ヘルプを閉じる"
            >
              ×
            </button>
          </div>
          <div>スクロール: 標準ブラウザスクロール</div>
          <div>Ctrl + ホイール: ズーム</div>
          <div>Ctrl + +/-: ズーム</div>
          <div>Ctrl + 0: リセット</div>
          <div>ズーム: {Math.round(zoom * 100)}%</div>
        </div>
      )}

      {/* ヘルプ再表示ボタン */}
      {!showZoomHelp && (
        <button
          onClick={() => onToggleHelp(true)}
          className="absolute top-2 right-2 z-20 rounded bg-blue-500 px-2 py-1 text-xs text-white hover:bg-blue-600"
          aria-label="ヘルプを表示"
        >
          ?
        </button>
      )}
    </>
  )
}
