import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Page Not Found
        </h2>
        <p className="text-gray-600 mb-6">
          Could not find the requested page.
        </p>
        <Link href="/dashboard">
          <Button variant="default">
            Return to Dashboard
          </Button>
        </Link>
      </div>
    </div>
  )
}