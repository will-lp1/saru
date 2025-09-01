"use client";

import Link from "next/link";
import Image from "next/image";

interface FooterProps {
  animatedStarCount: number;
}

export function Footer({ animatedStarCount }: FooterProps) {
  return (
    <footer className="w-full border-t border-border bg-background/80 backdrop-blur-sm py-4 mt-8">
      <div className="container mx-auto px-6 md:px-8 lg:px-12 flex flex-col items-center gap-4 text-sm text-muted-foreground md:grid md:grid-cols-3">
        {/* Left */}
        <span className="justify-self-start">© {new Date().getFullYear()} Saru. All rights reserved.</span>

        {/* Center – Contributors */}
        <Link
          href="/contributors"
          className="hover:text-foreground transition-colors justify-self-center"
        >
          Contributors
        </Link>

        {/* Right – Community links */}
        <div className="flex items-center gap-4 justify-self-end">
          <Link
            href="https://discord.gg/pZCeQpvMPA"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 hover:text-foreground transition-colors"
          >
            <Image src="/images/discord-logo.png" alt="Discord" width={16} height={16} className="size-4" />
            Discord
          </Link>

          <Link
            href="https://github.com/will-lp1/saru"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 hover:text-foreground transition-colors"
          >
            {/* GitHub mark */}
            <Image src="/images/github-logo.png" alt="Github" width={16} height={16} className="dark:invert size-4" />
            <span className="hidden sm:inline">GitHub</span>
            {/* Separator */}
            <span className="hidden sm:block h-4 w-px bg-border/60 mx-1" aria-hidden="true" />
            {/* Star group */}
            <span className="inline-flex items-center gap-0.5">
              <span className="font-mono tabular-nums w-[3.5ch] text-right">
                {animatedStarCount.toLocaleString()}
              </span>
              <svg
                aria-hidden="true"
                focusable="false"
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="text-yellow-400"
              >
                <path d="M12 .587l3.668 7.431 8.2 1.192-5.93 5.78 1.4 8.169L12 18.896l-7.338 3.863 1.4-8.169-5.93-5.78 8.2-1.192z" />
              </svg>
            </span>
          </Link>

        </div>
      </div>
    </footer>
  );
}