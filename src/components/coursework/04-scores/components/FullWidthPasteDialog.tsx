import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface FullWidthPasteDialogProps {
  open: boolean
  /** 半角へ寄せるか（閉じただけのときは false＝そのまま） */
  onAnswer: (toHalfWidthChars: boolean) => void
}

/**
 * 貼り付けに全角文字が含まれるとき、半角へ寄せてよいかを尋ねる。
 *
 * 全角を黙って半角へ変えない。`Ａ` と `A` が別の評語でありうるので、寄せてよいかを
 * 貼り付けのたびに（1回だけ）尋ねる。閉じただけのときは「そのまま」と同じ扱いにする
 * （黙って変換する方には倒さない）。
 */
export function FullWidthPasteDialog({
  open,
  onAnswer,
}: FullWidthPasteDialogProps) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onAnswer(false)
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>全角文字が検知されました</AlertDialogTitle>
          <AlertDialogDescription>
            半角文字でよろしいですか？「そのまま貼り付ける」を選ぶと、貼り付けた文字のまま入力します。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => onAnswer(false)}>
            そのまま貼り付ける
          </AlertDialogCancel>
          <AlertDialogAction onClick={() => onAnswer(true)}>
            半角にする
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
