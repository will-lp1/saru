import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type');

  if (
    type === 'post' &&
    searchParams.has('title') &&
    searchParams.has('author') &&
    searchParams.has('date')
  ) {
    const title = searchParams.get('title')?.slice(0, 100) ?? 'Untitled';
    const author = searchParams.get('author')?.slice(0, 50) ?? 'Anonymous';
    const date = searchParams.get('date') ?? '';

    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            background: 'white',
            padding: '60px',
            fontFamily: '"SF Pro Display", "Helvetica Neue", "Arial", sans-serif',
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 60,
              left: 60,
              fontSize: 28,
              fontWeight: 500,
              color: '#1f2937',
            }}
          >
            Saru
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              flexGrow: 1,
              paddingTop: 80,
            }}
          >
            <div
              style={{
                fontSize: 72,
                fontWeight: 800,
                color: '#1f2937',
                lineHeight: 1.1,
                maxWidth: '95%',
                textAlign: 'center',
              }}
            >
              {title}
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                marginTop: 32,
                fontSize: 32,
                fontWeight: 400,
                color: '#6b7280',
              }}
            >
              <span>{author}</span>
              <span style={{ margin: '0 12px' }}>•</span>
              <span>{date}</span>
            </div>
          </div>
        </div>
      ),
      { width: 1200, height: 630 }
    );
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'white',
          fontFamily: '"SF Pro Display", "Helvetica Neue", "Arial", sans-serif',
          padding: '60px',
        }}
      >
        <div
          style={{
            fontSize: 84,
            fontWeight: 500,
            letterSpacing: '-0.05em',
            color: '#1f2937',
          }}
        >
          Saru
        </div>
        <div
          style={{
            fontSize: 32,
            marginTop: 24,
            fontWeight: 400,
            color: '#6b7280',
            textAlign: 'center',
            maxWidth: '75%',
            lineHeight: 1.4,
          }}
        >
          The most satisfying, intuitive AI writing tool, and it&apos;s open source.
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
} 