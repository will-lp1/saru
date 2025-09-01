'use client';

import { usePathname } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

// Only display on the root and documents pages

export default function MobileWarning() {
  const pathname = usePathname();

  const shouldShow = ['/documents'].some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
  if (!shouldShow) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 dark:bg-background/80 md:hidden">
      <Card className="w-11/12 max-w-sm">
        <CardHeader>
          <CardTitle>Saru works best on desktop</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            For the best experience, please use a desktop device.
          </p>
        </CardContent>
      </Card>
    </div>
  );
} 