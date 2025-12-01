"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { toast } from "sonner";
import useSWR from "swr";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AnimatePresence, motion } from "framer-motion";

const formSchema = z.object({
  email: z.string().email(),
});

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type FormSchema = z.infer<typeof formSchema>;

function useWaitlistCount() {
  const { data, mutate } = useSWR<{ count: number }>(
    "/api/waitlist",
    fetcher,
    {
      revalidateOnFocus: false,
    },
  );

  return { count: data?.count ?? 0, mutate } as const;
}

export default function SDKPage() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const waitlist = useWaitlistCount();

  async function joinWaitlist(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const validation = formSchema.safeParse({ email });
    if (!validation.success) {
      toast.error("Please enter a valid email address");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Something went wrong");

      setSuccess(true);
      setEmail("");
      waitlist.mutate({ count: waitlist.count + 1 }, false);
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : "Something went wrong. Please try again.";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-16 md:px-8 lg:px-12">
      <div className="flex w-full max-w-3xl flex-col items-center gap-6 text-center">
        <header className="space-y-2">
          <p className="text-lg text-muted-foreground">
            Join the waitlist to get early access to the SDK for <i>AI-Native writing interfaces</i>.
          </p>
        </header>

        <AnimatePresence mode="wait" initial={false}>
          {success ? (
            <motion.div
              key="success"
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="flex h-11 w-full items-center justify-center"
            >
              <p className="text-sm font-medium text-muted-foreground">
                You&rsquo;re in! We&rsquo;ll keep you posted.
              </p>
            </motion.div>
          ) : (
            <motion.form
              key="form"
              onSubmit={joinWaitlist}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="flex w-full max-w-lg flex-col gap-3 sm:flex-row"
            >
              <Input
                type="email"
                placeholder="example@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 w-full rounded-md px-4 text-base font-medium placeholder:font-medium placeholder:text-muted-foreground md:text-base"
                disabled={isSubmitting}
                required
              />
              <Button
                variant="outline"
                type="submit"
                className="h-11 w-full pl-4 pr-3 text-base sm:w-fit"
                disabled={isSubmitting}
              >
                Join Waitlist <ChevronRight className="ml-1 h-5 w-5" />
              </Button>
            </motion.form>
          )}
        </AnimatePresence>

        <div className="relative flex flex-row items-center justify-center gap-2">
          <span className="size-2 rounded-full bg-green-600 dark:bg-green-400" />
          <span className="absolute left-0 size-2 rounded-full bg-green-600 blur-xs dark:bg-green-400" />
          <span className="text-sm text-green-600 dark:text-green-400 sm:text-base">
            {waitlist.count.toLocaleString()} people already joined
          </span>
        </div>
      </div>
    </main>
  );
}
