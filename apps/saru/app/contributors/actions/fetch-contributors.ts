"use server";

interface Contributor {
  login: string;
  id: number;
  avatar_url: string;
  html_url: string;
  contributions: number;
  type: string;
}

interface RepositoryStats {
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  subscribers_count: number;
  language: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export async function fetchContributors(): Promise<{
  contributors: Contributor[];
  stats: RepositoryStats;
}> {
  try {
    const repoOwner = "will-lp1";
    const repoName = "saru";
    
    const contributorsResponse = await fetch(
      `https://api.github.com/repos/${repoOwner}/${repoName}/contributors?per_page=100`,
      {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'SnowLeopard-App',
        },
        next: { revalidate: 3600 }, // Cache for 1 hour
      }
    );

    if (!contributorsResponse.ok) {
      throw new Error(`Failed to fetch contributors: ${contributorsResponse.status}`);
    }

    const contributors: Contributor[] = await contributorsResponse.json();

    // Fetch repository stats
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
      throw new Error(`Failed to fetch repository stats: ${repoResponse.status}`);
    }

    const stats: RepositoryStats = await repoResponse.json();

    return {
      contributors: contributors.filter(c => c.type === 'User'), // Filter out bots
      stats,
    };
  } catch (error) {
    console.error('Error fetching contributors:', error);
    throw new Error('Failed to fetch contributors data');
  }
}

export async function fetchContributorDetails(login: string): Promise<{
  name: string;
  bio: string;
  location: string;
  company: string;
  blog: string;
  twitter_username: string;
  public_repos: number;
  followers: number;
  following: number;
  created_at: string;
}> {
  try {
    const response = await fetch(
      `https://api.github.com/users/${login}`,
      {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'SnowLeopard-App',
        },
        next: { revalidate: 3600 }, // Cache for 1 hour
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch user details: ${response.status}`);
    }

    const userData = await response.json();
    
    return {
      name: userData.name || login,
      bio: userData.bio || '',
      location: userData.location || '',
      company: userData.company || '',
      blog: userData.blog || '',
      twitter_username: userData.twitter_username || '',
      public_repos: userData.public_repos || 0,
      followers: userData.followers || 0,
      following: userData.following || 0,
      created_at: userData.created_at || '',
    };
  } catch (error) {
    console.error('Error fetching contributor details:', error);
    throw new Error('Failed to fetch contributor details');
  }
}
