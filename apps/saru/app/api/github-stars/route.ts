import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const response = await fetch('https://api.github.com/repos/will-lp1/snowleopard', {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'SnowLeopard-App',
      },
      next: { revalidate: 300 }, // Cache for 5 minutes
    });

    if (!response.ok) {
      throw new Error(`GitHub API responded with status: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json({ stars: data.stargazers_count });
  } catch (error) {
    console.error('Error fetching GitHub stars:', error);
    // Return a fallback value if the API fails
    return NextResponse.json({ stars: 164 }, { status: 500 });
  }
}
