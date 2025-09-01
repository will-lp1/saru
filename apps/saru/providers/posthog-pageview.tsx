'use client'

import { useEffect, Suspense } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import posthog from 'posthog-js'

const posthogEnabled = process.env.NEXT_PUBLIC_POSTHOG_ENABLED === 'true'

function PostHogPageViewInner(): null {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (posthogEnabled && pathname) {
      let url = window.origin + pathname
      if (searchParams && searchParams.toString()) {
        url = url + `?${searchParams.toString()}`
      }
      // Capture pageview with the full URL
      posthog.capture(
        '$pageview',
        {
          '$current_url': url,
        }
      )
    }
  }, [pathname, searchParams]) 

  return null 
}

export function PostHogPageView(): JSX.Element {
 return (
    <Suspense fallback={null}>
      <PostHogPageViewInner />
    </Suspense>
  )
} 