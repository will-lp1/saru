"use client";
import React, { useEffect, useState } from 'react';
import { Markdown } from '@/components/markdown';
import { googleFonts } from '@/lib/fonts';
import { useTheme } from 'next-themes';

interface BlogProps {
  title: string;
  content: string;
  font?: string;
  accentColor?: string;
  textColorLight?: string;
  textColorDark?: string;
  author?: string;
  date?: string;
}

export const Blog: React.FC<BlogProps> = ({
  title,
  content,
  font = 'montserrat',
  accentColor,
  textColorLight,
  textColorDark,
  author,
  date,
}) => {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;
  // Pick correct text color based on theme
  const themeTextColor = resolvedTheme === 'dark' ? textColorLight : textColorDark;
  const fontClass = (googleFonts as Record<string, any>)[font]?.className || '';

  // Style for main container (accent)
  const mainStyle: React.CSSProperties = {
    ...(accentColor ? { '--accent-color': accentColor } as any : {}),
  };

  // Typography override for text color on prose elements
  const proseStyle: React.CSSProperties = themeTextColor
    ? ({
        '--tw-prose-body': themeTextColor,
        '--tw-prose-headings': themeTextColor,
        '--tw-prose-lead': themeTextColor,
        '--tw-prose-links': themeTextColor,
        '--tw-prose-bold': themeTextColor,
        '--tw-prose-counters': themeTextColor,
        '--tw-prose-bullets': themeTextColor,
        '--tw-prose-captions': themeTextColor,
        '--tw-prose-th-borders': themeTextColor,
        '--tw-prose-td-borders': themeTextColor,
      } as any)
    : {};

  return (
    <main className="min-h-screen bg-background" style={mainStyle}>
      <article className={`prose dark:prose-invert mx-auto py-16 px-4 sm:px-6 lg:px-8 ${fontClass}`} style={proseStyle}>
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tighter mb-8">{title}</h1>
        {(author || date) && (
          <div className="text-sm mb-6 flex items-center space-x-2 text-muted-foreground">
            {author && <span>By <strong>{author}</strong></span>}
            {date && <span>{date}</span>}
          </div>
        )}
        <Markdown>{content}</Markdown>
      </article>
    </main>
  );
}; 