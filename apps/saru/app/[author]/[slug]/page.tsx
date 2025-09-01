import { notFound } from 'next/navigation';
import { db } from '@saru/db';
import * as schema from '@saru/db';
import { eq, and } from 'drizzle-orm';
import { Blog } from '@/components/blog';
import AIChatWidget from '@/components/ai-chat-widget';
import ThemeToggle from '@/components/theme-toggle';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default async function Page({ params }: any) {
  const { author, slug } = await params;
  const result = await db
    .select()
    .from(schema.Document)
    .where(
      and(
        eq(schema.Document.author, author),
        eq(schema.Document.slug, slug),
        eq(schema.Document.visibility, 'public')
      )
    )
    .limit(1);
  const doc = result[0];
  if (!doc) {
    notFound();
  }
  const styleObj = (doc.style as any) || {};
  const font = styleObj.font as any;
  const accentColor = styleObj.accentColor as string;
  const textColorLight = styleObj.textColorLight as string;
  const textColorDark = styleObj.textColorDark as string;
  const dateString = new Date(doc.createdAt).toLocaleDateString('en-US');
  return (
    <>
      <ThemeToggle />
      <Link href="/register">
        <Button variant="outline" className="fixed top-4 right-4 z-50">
          Sign up to Saru
        </Button>
      </Link>
      <Blog
        title={doc.title}
        content={doc.content || ''}
        font={font}
        accentColor={accentColor}
        textColorLight={textColorLight}
        textColorDark={textColorDark}
        author={doc.author || author}
        date={dateString}
      />
      <AIChatWidget
        context={doc.content || ''}
        title={doc.title}
        author={doc.author || author}
        date={dateString}
      />
    </>
  );
} 