"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { 
  Area, 
  AreaChart, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { 
  Star, 
  GitFork, 
  AlertCircle, 
  GitPullRequest,
  Loader2
} from "lucide-react";
import { useRouter } from "next/navigation";
import { fetchContributors } from "./actions/fetch-contributors";
import { fetchRepositoryAnalytics } from "./actions/fetch-repository-analytics";
import { Header } from "@/components/landing/header";
import { Footer } from "@/components/landing/footer";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useCounter } from "@/components/landing/use-counter";
import { Crimson_Text } from "next/font/google";
import { Skeleton } from "@/components/ui/skeleton";
const crimson = Crimson_Text({
  weight: ["400", "700"],
  subsets: ["latin"],
  display: "swap",
});

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

export default function ContributorsPage() {
  const router = useRouter();
  const [data, setData] = useState<{ contributors: Contributor[], stats: RepositoryStats } | null>(null);
  const [analytics, setAnalytics] = useState<RepositoryAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [starGoal, setStarGoal] = useState(0);
  const { count: animatedStarCount } = useCounter(starGoal);

  useEffect(() => {
    const loadData = async () => {
      try {
        const result = await fetchContributors();
        setData(result);
        setStarGoal(result.stats.stargazers_count);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    const loadAnalytics = async () => {
      try {
        const analyticsData = await fetchRepositoryAnalytics();
        setAnalytics(analyticsData);
      } catch (error) {
        console.error('Error loading analytics:', error);
      } finally {
        setAnalyticsLoading(false);
      }
    };
    loadAnalytics();
  }, []);

  const handleBeginClick = () => {
    router.push("/documents");
  };

  const getActivityColor = (value: number) => {
    const intensity = Math.max(0.1, Math.min(1, value / 5));
    if (intensity > 0.8) return '#00d472';
    if (intensity > 0.6) return '#26a641';
    if (intensity > 0.4) return '#39d353';
    if (intensity > 0.2) return '#9be9a8';
    return '#ebedf0';
  };

  if (loading) {
    return (
              <div className="min-h-screen bg-background flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-4" />
          </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-6">
          <h1 className="text-3xl font-bold text-foreground mb-4">
            Unable to Load Contributors
          </h1>
          <p className="text-xl text-muted-foreground">
            Please try refreshing the page or check your connection.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      {/* Header */}
      <Header
        hasSession={false}
        animatedStarCount={animatedStarCount}
        onBeginClick={handleBeginClick}
      />

      {/* Page Hero */}
      <section className="pt-16 pb-6 bg-background">
        <div className="container mx-auto px-6 md:px-8 lg:px-12 flex flex-col items-center text-center">
          <h1 className={`text-4xl md:text-6xl ${crimson.className} tracking-[-0.04em] leading-tight text-foreground`}>
            Our Contributors
          </h1>
          <p className="text-base md:text-lg text-muted-foreground mt-3 max-w-xl">
            Building Snow Leopard together
          </p>
        </div>
      </section>

      {/* Main Content */}
      <main>
                {/* Contributors Section */}
                <section className="mt-4 bg-background">
          <div className="container mx-auto px-6 md:px-8 lg:px-12 w-full">

            {/* Contributors Grid */}
            <div className="mx-auto flex justify-center">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6 md:gap-8">
                {data.contributors.map((contributor) => (
                  <a
                    key={contributor.id}
                    href={contributor.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    <Card className="group cursor-pointer rounded-xl p-4">
                      <div className="text-center">
                        <div className="mb-3">
                          <Image
                            src={contributor.avatar_url}
                            alt={contributor.login}
                            width={48}
                            height={48}
                            className="rounded-full mx-auto border-2 border-transparent group-hover:border-border transition-all"
                          />
                        </div>
                        <h3 className="font-medium text-foreground text-sm truncate">
                          {contributor.login}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1">
                          {contributor.contributions}
                        </p>
                      </div>
                    </Card>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </section>
        {/* Repository Stats Section */}
        <section className="mt-12 pb-4 bg-background">
          <div className="container mx-auto px-6 md:px-8 lg:px-12">

            {/* Skinny Stats Bar */}
            <Card className="rounded-xl px-5 py-3 shadow-sm mb-10">
              <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-xs sm:text-sm">
                {/* Stars */}
                <div className="flex items-center gap-1.5">
                  <Star className="size-3.5 text-foreground" />
                  <span className="font-medium text-foreground">{data.stats.stargazers_count.toLocaleString()}</span>
                  <span className="text-muted-foreground">stars</span>
                </div>
                <Separator orientation="vertical" className="h-4" />
                {/* Forks */}
                <div className="flex items-center gap-1.5">
                  <GitFork className="size-3.5 text-foreground" />
                  <span className="font-medium text-foreground">{data.stats.forks_count.toLocaleString()}</span>
                  <span className="text-muted-foreground">forks</span>
                </div>
                <Separator orientation="vertical" className="h-4" />
                {/* Issues */}
                <div className="flex items-center gap-1.5">
                  <AlertCircle className="size-3.5 text-foreground" />
                  <span className="font-medium text-foreground">{data.stats.open_issues_count.toLocaleString()}</span>
                  <span className="text-muted-foreground">issues</span>
                </div>
                <Separator orientation="vertical" className="h-4" />
                {/* PRs */}
                <div className="flex items-center gap-1.5">
                  <GitPullRequest className="size-3.5 text-foreground" />
                  <span className="font-medium text-foreground">{analytics?.pullRequestsCount || 0}</span>
                  <span className="text-muted-foreground">PRs</span>
                </div>
              </div>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Growth Chart Card */}
              <Card className="h-full flex flex-col rounded-xl">
                <CardHeader className="p-4 text-sm font-medium">Repository Growth</CardHeader>
                <CardContent className="p-4 flex-grow">
                  {analyticsLoading ? (
                    <div className="flex items-center justify-center h-32">
                      <div className="text-muted-foreground text-sm">Loading growth...</div>
                    </div>
                  ) : (
                    <div className="h-40">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={analytics?.growthData || []} margin={{ top: 0, right: 5, left: -15, bottom: 0 }}>
                          <defs>
                            <linearGradient id="starsGradient2" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="hsl(var(--foreground))" stopOpacity={0.1}/>
                              <stop offset="95%" stopColor="hsl(var(--foreground))" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <XAxis dataKey="date" hide />
                          <YAxis hide />
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.2} />
                          <Tooltip contentStyle={{ fontSize: '10px' }} />
                          <Area type="monotone" dataKey="stars" stroke="hsl(var(--foreground))" strokeWidth={1.5} fill="url(#starsGradient2)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  <p className="text-[10px] text-muted-foreground text-center mt-2">Stars growth over time</p>
                </CardContent>
              </Card>

              {/* Weekly Activity Card - bulkier */}
              <Card className="h-full flex flex-col rounded-xl">
                <CardHeader className="p-6 text-base font-medium">Weekly Activity</CardHeader>
                <CardContent className="p-6 text-sm text-muted-foreground flex-grow flex flex-col justify-center">
                  {analyticsLoading ? (
                    <div className="flex items-center justify-center h-32">
                      <div className="text-muted-foreground">Loading activity...</div>
                    </div>
                  ) : (
                    <div className="flex justify-center">
                      <div className="inline-flex items-end gap-2">
                        {analytics?.activityData?.map((day) => {
                          const greenShade = getActivityColor(day.activity2);
                          return (
                            <div key={day.day} className="flex flex-col items-center gap-1">
                              <div 
                                className="w-4 rounded-sm transition-all duration-300"
                                style={{ 
                                  backgroundColor: greenShade,
                                  height: Math.max(16, day.activity2 * 12) + 'px'
                                }}
                              />
                              <span className="text-[10px] text-muted-foreground">{day.day}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground text-center mt-4">Commits per day of week</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <Footer animatedStarCount={animatedStarCount} />
    </div>
  );
}
