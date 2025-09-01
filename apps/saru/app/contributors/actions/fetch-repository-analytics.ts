"use server";

interface RepositoryAnalytics {
  growthData: Array<{
    date: string;
    stars: number;
    forks: number;
  }>;
  activityData: Array<{
    day: string;
    activity1: number;
    activity2: number;
  }>;
  pullRequestsCount: number;
}

export async function fetchRepositoryAnalytics(): Promise<RepositoryAnalytics> {
  try {
    const repoOwner = "will-lp1";
    const repoName = "saru";
    
    const repoResponse = await fetch(
      `https://api.github.com/repos/${repoOwner}/${repoName}`,
      {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'SnowLeopard-App',
        },
        next: { revalidate: 3600 }, // Cache for 1 hour
      }
    );

    if (!repoResponse.ok) {
      throw new Error(`Failed to fetch repository data: ${repoResponse.status}`);
    }

    const repoData = await repoResponse.json();
    
    const prResponse = await fetch(
      `https://api.github.com/repos/${repoOwner}/${repoName}/pulls?state=open&per_page=1`,
      {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'SnowLeopard-App',
        },
        next: { revalidate: 3600 },
      }
    );

    let pullRequestsCount = 0;
    if (prResponse.ok) {
      const linkHeader = prResponse.headers.get('link');
      if (linkHeader) {
        const match = linkHeader.match(/page=(\d+)>; rel="last"/);
        if (match) {
          pullRequestsCount = parseInt(match[1]);
        }
      }
    }

    const createdAt = new Date(repoData.created_at);
    const now = new Date();
    const daysSinceCreation = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
    
    const growthData = generateGrowthData(
      createdAt,
      repoData.stargazers_count,
      repoData.forks_count,
      daysSinceCreation
    );

    const activityData = await generateActivityData(repoOwner, repoName);

    return {
      growthData,
      activityData,
      pullRequestsCount,
    };
  } catch (error) {
    console.error('Error fetching repository analytics:', error);
    return {
      growthData: generateFallbackGrowthData(),
      activityData: generateFallbackActivityData(),
      pullRequestsCount: 0,
    };
  }
}

function generateGrowthData(
  createdAt: Date,
  currentStars: number,
  currentForks: number,
  totalDays: number
): Array<{ date: string; stars: number; forks: number }> {
  const data = [];
  const points = Math.min(13, totalDays); // Max 13 data points
  
  for (let i = 0; i < points; i++) {
    const date = new Date(createdAt);
    date.setDate(date.getDate() + Math.floor((totalDays * i) / (points - 1)));
    
    const progress = i / (points - 1);
    const stars = Math.floor(currentStars * Math.pow(progress, 1.5));
    const forks = Math.floor(currentForks * Math.pow(progress, 1.2));
    
    data.push({
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      stars,
      forks,
    });
  }
  
  return data;
}

async function generateActivityData(
  repoOwner: string,
  repoName: string
): Promise<Array<{ day: string; activity1: number; activity2: number }>> {
  try {
    const commitsResponse = await fetch(
      `https://api.github.com/repos/${repoOwner}/${repoName}/commits?per_page=100`,
      {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'SnowLeopard-App',
        },
        next: { revalidate: 3600 },
      }
    );

    if (!commitsResponse.ok) {
      return generateFallbackActivityData();
    }

    const commits = await commitsResponse.json();
    
    const activityByDay: { [key: string]: number } = {
      'Mon': 0, 'Tue': 0, 'Wed': 0, 'Thu': 0, 'Fri': 0, 'Sat': 0, 'Sun': 0
    };

    commits.forEach((commit: any) => {
      const commitDate = new Date(commit.commit.author.date);
      const dayName = commitDate.toLocaleDateString('en-US', { weekday: 'short' });
      if (activityByDay[dayName] !== undefined) {
        activityByDay[dayName]++;
      }
    });

    const maxActivity = Math.max(...Object.values(activityByDay));
    const safeMaxActivity = maxActivity || 1;
    const normalizedActivity = Object.entries(activityByDay).map(([day, count]) => ({
      day,
      activity1: Math.max(1, Math.floor(count * 0.2)), 
      activity2: Math.max(1, Math.floor((count / safeMaxActivity) * 5)),
    }));

    return normalizedActivity;
  } catch (error) {
    console.error('Error fetching activity data:', error);
    return generateFallbackActivityData();
  }
}

function generateFallbackGrowthData(): Array<{ date: string; stars: number; forks: number }> {
  return [
    { date: 'Jul 26', stars: 0, forks: 0 },
    { date: 'Jul 28', stars: 50, forks: 5 },
    { date: 'Jul 30', stars: 120, forks: 12 },
    { date: 'Aug 1', stars: 200, forks: 20 },
    { date: 'Aug 3', stars: 280, forks: 28 },
    { date: 'Aug 5', stars: 360, forks: 36 },
    { date: 'Aug 7', stars: 440, forks: 44 },
    { date: 'Aug 9', stars: 520, forks: 52 },
    { date: 'Aug 12', stars: 620, forks: 62 },
    { date: 'Aug 15', stars: 720, forks: 72 },
    { date: 'Aug 17', stars: 820, forks: 82 },
    { date: 'Aug 20', stars: 920, forks: 92 },
    { date: 'Aug 23', stars: 947, forks: 113 },
  ];
}

function generateFallbackActivityData(): Array<{ day: string; activity1: number; activity2: number }> {
  return [
    { day: 'Mon', activity1: 1, activity2: 1 },
    { day: 'Tue', activity1: 1, activity2: 1 },
    { day: 'Wed', activity1: 1, activity2: 2 },
    { day: 'Thu', activity1: 1, activity2: 3 },
    { day: 'Fri', activity1: 1, activity2: 4 },
    { day: 'Sat', activity1: 1, activity2: 2 },
    { day: 'Sun', activity1: 1, activity2: 1 },
  ];
}
