"use client";

import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Star } from "lucide-react";

interface HeaderProps {
  hasSession: boolean;
  animatedStarCount: number;
  onBeginClick: () => void;
}

export function Header({ hasSession, animatedStarCount, onBeginClick }: HeaderProps) {
  return (
    <header className="absolute top-0 w-full z-10 py-4">
      <div className="container mx-auto flex justify-between items-center px-6 md:px-8 lg:px-12">
        {/* Brand */}
        <h1 className="text-xl font-normal tracking-tighter text-foreground/90">
          <Link href="/">
            Saru
          </Link>
        </h1>

        {/* Actions */}
        <div className="flex items-center gap-2">


          {/* GitHub */}
          <Link
            href="https://github.com/will-lp1/saru"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-1 rounded-full border border-border bg-background px-3 h-8 text-xs hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <Image
              src="/images/github-logo.png"
              alt="Github"
              width={14}
              height={14}
              className="dark:invert size-3.5"
            />
            <span className="hidden sm:inline">GitHub</span>
            {/* Separator */}
            <span className="hidden sm:block h-4 w-px bg-border/60 mx-1" aria-hidden="true" />
            {/* Stars group */}
            <span className="inline-flex items-center gap-0.5">
              <span className="font-mono tabular-nums w-[3.5ch] text-right">
                {animatedStarCount.toLocaleString()}
              </span>
              <Star className="size-3 transition-colors duration-200 group-hover:text-yellow-300 group-hover:fill-yellow-300" />
            </span>
          </Link>

          {/* CTA */}
          <Button
            variant="outline"
            size="sm"
            className="rounded-full group flex items-center h-8"
            onClick={onBeginClick}
          >
            {hasSession ? "Open" : "Begin"}
            <span className="inline-block ml-2 text-xs transition-transform group-hover:translate-x-0.5">
              ›
            </span>
          </Button>
        </div>
      </div>
    </header>
  );
}