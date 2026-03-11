"use client"

import Link from "next/link"
import type { ComponentProps, MouseEvent } from "react"

import { useNavigationGuardContext } from "@/contexts/NavigationGuardContext"

type GuardedLinkProps = ComponentProps<typeof Link>

export function GuardedLink({ onClick, href, ...props }: GuardedLinkProps) {
  const { requestNavigation } = useNavigationGuardContext()

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    const hrefString = typeof href === "string" ? href : (href.pathname ?? "/")
    if (!requestNavigation(hrefString)) {
      e.preventDefault()
    } else if (onClick) {
      onClick(e)
    }
  }

  return <Link href={href} onClick={handleClick} {...props} />
}
