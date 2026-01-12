import Link from "next/link"

import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <div className="text-center">
        <h2 className="mb-4 text-2xl font-bold text-gray-900">
          Page Not Found
        </h2>
        <p className="mb-6 text-gray-600">Could not find the requested page.</p>
        <Link href="/dashboard">
          <Button variant="default">Return to Dashboard</Button>
        </Link>
      </div>
    </div>
  )
}
