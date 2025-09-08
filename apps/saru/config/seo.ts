import type { Metadata } from "next";

const TITLE = "Saru";
const DESCRIPTION =
  "Saru is an open-source productivity tool for writing, note-taking, and organizing ideas with AI assistance. Fast, customizable, and user-friendly.";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://trysaru.com/";

export const seoConfig: Metadata = {
  title: {
    default: TITLE,
    template: "%s | Saru", 
  },
  description: DESCRIPTION,
  applicationName: "Saru",
  category: "Productivity",
  keywords: [
    // Branding
    "Saru",
    "Saru",
    "Saru",
    "Saru Writing",
    "Saru app",
    "Saru AI",
    "Saru open source",

    // Core Product
    "AI writing tool",
    "AI note-taking app",
    "AI document editor",
    "AI writing assistant",
    "AI note app",
    "AI productivity software",
    "writing app with AI",
    "AI text editor",
    "AI notes",
    "AI powered writing",
    "AI notepad",
    "AI humanizer",


    // Open-source & Tech
    "open-source notes app",
    "open-source writing tool",
    "open-source productivity tool",
    "open-source editor",
    "LLM writing app",
    "open-source document editor",
    "open-source knowledge management",
    "self-hosted writing tool",
    "self-hosted notes app",

    // Productivity & Use Cases
    "productivity tool",
    "note taking",
    "note-taking software",
    "knowledge base app",
    "markdown notes app",
    "team collaboration tool",
    "online note-taking tool",
    "writing productivity app",
    "writing software",
    "focus writing app",

    // Benefits & Features
    "fast writing app",
    "user-friendly editor",
    "customizable editor",
    "minimal writing app",
    "lightweight notes app",
    "distraction-free writing",
    "document organization",
    "knowledge management",
    "personal knowledge base",
    "content writing app",
    "cheap productivity tool",

    // // Competitor/Comparisons
    // "Notion alternative",
    // "Obsidian alternative",
    // "Evernote alternative",
    // "Roam Research alternative",
    // "open-source Notion alternative",
    // "open-source Obsidian alternative",
    // "AI Notion alternative",
    // "AI Obsidian alternative",

    // Search Intent Phrases
    "best open-source writing tool",
    "best open-source notes app",
    "best AI writing software",
    "best productivity app 2025",
    "top AI writing assistant",
    "how to take notes with AI",
    "best document editor with AI",
    "AI note taking for students",
    "AI writing app for teams",
    "best free writing app",
    "best free note-taking app",
  ],  
  icons: {
    icon: "/favicon.ico",
  },
  metadataBase: new URL(BASE_URL),
  verification:{
    google: 'q_spHn9uTXgy715SiSp97ElF_ZbU5SxZbIUnhn6Oe8E',
  },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: BASE_URL,
    siteName: "Saru",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: '/api/og',
        width: 1200,
        height: 630,
        alt: "Saru – Open Source Writing Tool",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    site: "@WriteWithSaru",
    creator: "@WriteWithSaru",
    images: [
        {
          url: '/api/og',
          alt: 'Saru - Tab, Tab, Apply Brilliance',
        },
      ],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
};
