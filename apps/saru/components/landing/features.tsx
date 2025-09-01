"use client";

import React, { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { CardHeader, Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GripVertical, X, Check } from "lucide-react";
import { Crimson_Text } from "next/font/google";
import { Switch } from "@/components/ui/switch";

const crimson = Crimson_Text({
  weight: ["400", "700"],
  subsets: ["latin"],
  display: "swap",
});

export function Features() {
  const featuresRef = useRef<HTMLElement>(null);
  const isFeaturesInView = useInView(featuresRef, { once: true, amount: 0.3 });
  const card1Ref = useRef<HTMLDivElement>(null);
  const card2Ref = useRef<HTMLDivElement>(null);
  const card3Ref = useRef<HTMLDivElement>(null);
  const card4Ref = useRef<HTMLDivElement>(null);
  const card5Ref = useRef<HTMLDivElement>(null);
  const card6Ref = useRef<HTMLDivElement>(null);
  const card1InView = useInView(card1Ref, { once: true, amount: 0.5 });
  const card2InView = useInView(card2Ref, { once: true, amount: 0.5 });
  const card3InView = useInView(card3Ref, { once: true, amount: 0.5 });
  const card4InView = useInView(card4Ref, { once: true, amount: 0.5 });
  const card5InView = useInView(card5Ref, { once: true, amount: 0.5 });
  const card6InView = useInView(card6Ref, { once: true, amount: 0.5 });

  const StyleToggleDemo = ({ inView }: { inView: boolean }) => {
    const [isEnabled, setIsEnabled] = React.useState(false);

    React.useEffect(() => {
      if (inView) {
        const timer = setTimeout(() => setIsEnabled(true), 1500);
        return () => clearTimeout(timer);
      }
    }, [inView]);

    return (
      <div className="rounded-md border p-4 w-full">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium">Apply Writer Style</span>
          <Switch
            checked={isEnabled}
            onCheckedChange={setIsEnabled}
            className="scale-110"
          />
        </div>
      </div>
    );
  };

  const modelNames = ["Llama", "Kimi", "Deepseek", "Claude"] as const;
  const proIndex = 3;

  return (
    <section
      id="features"
      ref={featuresRef}
      aria-labelledby="features-heading"
      className={`py-20 ${isFeaturesInView ? "in-view" : ""}`}
    >
      <div className="container mx-auto px-6 md:px-8 lg:px-12">
        <div className="text-center mb-16">
          <h2
            id="features-heading"
            className={`text-4xl md:text-5xl font-medium ${crimson.className} tracking-tight text-foreground`}
          >
            Explore the Magic
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-xl mx-auto">
            Discover how Saru transforms your writing experience with these core features.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Card 1 */}
          <motion.div
            ref={card1Ref}
            initial={{ opacity: 0, y: 20 }}
            animate={card1InView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="w-full h-full"
          >
            <Card className="h-full flex flex-col min-h-[320px] rounded-xl overflow-visible">
              <CardHeader className="p-6 text-base font-medium">
                Real-time Inline Suggestions
              </CardHeader>
              <CardContent className="p-6 text-sm text-muted-foreground flex-grow">
                <p className="demo-prose-mirror-style">
                  <span className="demo-text-base">You start typing, and the AI offers</span>
                  <span className="inline-suggestion-wrapper">
                    <span
                      className="demo-inline-suggestion-animated"
                      data-suggestion=" a helpful completion."
                    ></span>
                    <kbd className="inline-tab-icon">Tab</kbd>
                  </span>
                </p>
              </CardContent>
            </Card>
          </motion.div>

          {/* Card 2 */}
          <motion.div
            ref={card2Ref}
            initial={{ opacity: 0, y: 20 }}
            animate={card2InView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="w-full h-full"
          >
            <Card className="h-full flex flex-col min-h-[320px] rounded-xl overflow-visible">
              <CardHeader className="p-6 text-base font-medium">
                Powerful Selection Edits
              </CardHeader>
              <CardContent className="p-6 text-sm text-muted-foreground flex-grow relative overflow-visible">
                <p className="demo-prose-mirror-style">
                  <span className="demo-text-base">
                    This phrasing <span className="demo-selected-text-animated">is a bit weak and verbose.</span> Let&apos;s ask the AI to improve it.
                  </span>
                </p>
                <div className="demo-suggestion-overlay-animated border border-border">
                  <div className="demo-overlay-header">
                    <GripVertical size={14} className="text-muted-foreground/70 demo-overlay-drag-handle" />
                    <h3 className="text-xs font-medium">Suggestion</h3>
                  </div>
                  <div className="demo-overlay-input-placeholder" />
                  <div className="demo-overlay-diff-view">
                    <span className="text-red-500 line-through dark:text-red-400/70">
                      is a bit weak and verbose.
                    </span>
                    <span className="text-green-600 dark:text-green-400/70 ml-1 demo-diff-new-text-animated">
                      lacks punch and impact.
                    </span>
                  </div>
                  <div className="demo-overlay-actions">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 py-1 text-xs hover:text-destructive rounded-full"
                    >
                      <X size={13} strokeWidth={2.5} className="mr-1" /> Reject
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 py-1 text-xs hover:text-primary rounded-full"
                    >
                      <Check size={13} strokeWidth={2.5} className="mr-1" /> Accept
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Card 3 */}
          <motion.div
            ref={card3Ref}
            initial={{ opacity: 0, y: 20 }}
            animate={card3InView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="w-full h-full"
          >
            <Card className="h-full flex flex-col min-h-[320px] rounded-xl overflow-visible">
              <CardHeader className="p-6 text-base font-medium">
                Instant Synonym Finder
              </CardHeader>
              <CardContent className="p-6 text-sm text-muted-foreground flex-grow">
                <p className="demo-prose-mirror-style relative">
                  <span className="demo-text-base">Find better words with ease. The AI presents contextually</span>
                  <span className="demo-synonym-word-animated" data-word="relevant">
                    relevant
                    <span className="demo-synonym-menu-animated">
                      <span>apt</span>
                      <span>pertinent</span>
                      <span>fitting</span>
                    </span>
                  </span>
                  <span className="demo-text-base"> synonyms.</span>
                </p>
              </CardContent>
            </Card>
          </motion.div>

          {/* Card 4 */}
          <motion.div
            ref={card4Ref}
            initial={{ opacity: 0, y: 20 }}
            animate={card4InView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="w-full h-full"
          >
            <Card className="h-full flex flex-col min-h-[320px] rounded-xl overflow-visible">
              <CardHeader className="p-6 text-base font-medium">
                AI Writing That Sounds Like You
              </CardHeader>
              <CardContent className="p-6 text-sm text-muted-foreground flex-grow flex flex-col justify-between items-center">
                <div className="w-full flex flex-col items-center flex-grow justify-center">
                  <StyleToggleDemo inView={card4InView} />
                </div>
                <p className="text-center w-full mt-8">
                  Trained on your writing to apply your unique style.
                </p>
              </CardContent>
            </Card>
          </motion.div>

          {/* Card 5 */}
          <motion.div
            ref={card5Ref}
            initial={{ opacity: 0, y: 20 }}
            animate={card5InView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="w-full h-full"
          >
            <Card className="h-full flex flex-col min-h-[320px] rounded-xl">
              <CardHeader className="p-6 text-base font-medium">
                Access Premium Models
              </CardHeader>
              <CardContent className="p-6 text-sm text-muted-foreground flex-grow flex flex-col justify-between items-center">
                <div className="w-full flex items-center justify-center gap-0" style={{ height: "112px" }}>
                  {modelNames.map((name, i) => {
                    const mid = (modelNames.length - 1) / 2;
                    const offset = i - mid;
                    const rot = offset * 8;
                    const y = Math.abs(offset) * 8;
                    return (
                      <motion.div
                        key={name}
                        initial={{ opacity: 0, rotate: 0, y: 0 }}
                        animate={card5InView ? { opacity: 1, rotate: rot, y, transition: { delay: 0.2 + i * 0.1, type: "spring", stiffness: 140, damping: 15 } } : {}}
                        className="w-20 h-28 bg-background border border-border rounded-lg flex items-center justify-center mx-[-4px] shadow-sm relative"
                        style={{ zIndex: 10 - Math.abs(offset) }}
                      >
                        {i === proIndex && (
                          <span className="absolute top-1 right-1 bg-accent text-accent-foreground text-[10px] px-1 rounded">Pro</span>
                        )}
                        <span className="text-xs font-medium">{name}</span>
                      </motion.div>
                    );
                  })}
                </div>
                <p className="text-sm text-muted-foreground text-center w-full mt-8">
                  Unlimited, free access to the best AI models.
                </p>
              </CardContent>
            </Card>
          </motion.div>

          {/* Card 6 */}
          <motion.div
            ref={card6Ref}
            initial={{ opacity: 0, y: 20 }}
            animate={card6InView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="w-full h-full"
          >
            <Card className="h-full flex flex-col min-h-[320px] rounded-xl">
              <CardHeader className="p-6 text-base font-medium">
                One-Click Publish & Share
              </CardHeader>
              <CardContent className="p-6 text-sm text-muted-foreground flex-grow flex flex-col justify-between items-center">
                <div className="w-full flex flex-col items-center">
                  <div className="relative w-44 h-32 rounded-lg border border-border bg-background shadow-sm overflow-hidden">
                    <div className="h-5 bg-muted flex items-center px-2 text-[9px] text-muted-foreground/90 font-mono gap-1">
                      <span className="truncate">you/your-post</span>
                    </div>
                    <div className="p-3 space-y-1">
                      <div className="h-2.5 bg-muted rounded w-2/3" />
                      <div className="h-2.5 bg-muted rounded w-full" />
                      <div className="h-2.5 bg-muted rounded w-5/6" />
                    </div>
                    <div className="absolute bottom-2 right-2 w-8 h-4 rounded-full bg-primary flex items-center justify-center text-[6px] text-primary-foreground shadow">
                      Ask Leo
                    </div>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground text-center w-full mt-8">
                  Publish in one click & share with AI chat support.
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </section>
  );
}