"use client"

import { useBreakpoint } from "@/hooks/use-breakpoint"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { sendFeedbackToDiscord } from "@/lib/actions/feedback"
import { authClient } from "@/lib/auth-client"
import {
  X,
  CheckCircle as SealCheck,
  Loader2 as Spinner,
  Heart,
} from "lucide-react"
import { AnimatePresence, motion } from "framer-motion"
import { useEffect, useState } from "react"
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const TRANSITION_CONTENT = {
  ease: "easeOut",
  duration: 0.2,
}

export function FeedbackWidget({ className }: { className?: string }) {
  const [status, setStatus] = useState<
    "idle" | "submitting" | "success" | "error"
  >("idle")
  const [feedback, setFeedback] = useState("")
  const [isOpen, setIsOpen] = useState(false)
  const isMobileOrTablet = useBreakpoint(896)
  const { data: session, isPending: isSessionLoading } = authClient.useSession()
  const userId = session?.user?.id
  const userEmail = session?.user?.email

  useEffect(() => {
    setStatus("idle")
    setFeedback("")
  }, [isOpen])

  const closeMenu = () => {
    setFeedback("")
    setStatus("idle")
    setIsOpen(false)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!userId) {
      toast.error("Please login to submit feedback")
      return
    }

    setStatus("submitting")
    if (!feedback.trim()) {
      setStatus("idle")
      return
    }

    try {
      const result = await sendFeedbackToDiscord({
        feedbackContent: feedback,
        userId: userId,
        userEmail: userEmail,
      })

      if (!result.success) {
        throw new Error(result.error || 'Failed to send feedback to Discord.')
      }
      
      await new Promise((resolve) => setTimeout(resolve, 1200))
      setStatus("success")
      setTimeout(() => {
        closeMenu()
      }, 2500)
    } catch (error: any) {
      console.error("Error submitting feedback:", error)
      toast.error(`Error submitting feedback: ${error.message || 'Unknown error sending to Discord'}`)
      setStatus("error")
    }
  }

  if (isMobileOrTablet || isSessionLoading || !userId) {
    return null
  }

  return (
    <SidebarMenu className={className}>
      <SidebarMenuItem>
        <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton className="group data-[state=open]: border border-r text-accent-foreground data-[state=open]:text-sidebar-accent-foreground h-10 hover:bg-accent/50 transition-colors duration-200">
              <span className="group-hover:text-primary transition-colors duration-200">Feedback</span>
              <span className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <Heart className="size-3 text-primary" />
              </span>
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="top"
            className="w-[--radix-popper-anchor-width] p-0 rounded-lg border-b border-zinc-200 dark:border-zinc-700 shadow-lg"
            sideOffset={5}
          >
            <div className="h-[240px] w-full">
              <AnimatePresence mode="popLayout">
                {status === "success" ? (
                  <motion.div
                    key="success"
                    className="flex h-[240px] w-full flex-col items-center justify-center px-5"
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    transition={TRANSITION_CONTENT}
                  >
                    <div className="rounded-full bg-green-500/10 p-3">
                      <SealCheck className="size-8 text-green-500" />
                    </div>
                    <p className="text-foreground mt-5 mb-2 text-center text-base font-medium">
                      Thank you for your feedback!
                    </p>
                    <p className="text-muted-foreground text-center text-sm max-w-[250px]">
                      Your input helps make Saru better for everyone.
                    </p>
                  </motion.div>
                ) : (
                  <motion.form
                    key="form"
                    className="flex h-full flex-col"
                    onSubmit={handleSubmit}
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    transition={TRANSITION_CONTENT}
                  >
                    <div className="p-3 border-b border-border/50">
                      <h3 className="text-sm font-medium text-foreground">Share your thoughts</h3>
                      <p className="text-xs text-muted-foreground mt-1">Help us improve Saru</p>
                    </div>
                    
                    <div className="relative flex-1">
                      <motion.div
                        aria-hidden="true"
                        initial={{
                          opacity: 1,
                        }}
                        animate={{
                          opacity: feedback ? 0 : 1,
                        }}
                        transition={{
                          duration: 0.2,
                        }}
                        className="text-muted-foreground pointer-events-none absolute top-3.5 left-4 text-xs leading-[1.4] select-none"
                      >
                        <p className="text-xs text-muted-foreground/80">Suggestions:</p>
                        <ul className="ml-2 mt-1 space-y-1">
                          <li>• Features</li>
                          <li>• Improvements</li>
                          <li>• Issues</li>
                        </ul>
                      </motion.div>
                      <textarea
                        className="text-foreground h-full w-full resize-none bg-transparent px-4 py-3.5 text-sm outline-hidden focus:ring-0 focus:outline-none"
                        autoFocus
                        onChange={(e) => setFeedback(e.target.value)}
                        disabled={status === "submitting"}
                        placeholder=""
                      />
                    </div>
                    
                    <div className="flex justify-between items-center p-3 border-t border-border/50">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={closeMenu}
                        aria-label="Close popover"
                        disabled={status === "submitting"}
                        className="h-8 w-8 p-0 rounded-full hover:bg-muted"
                      >
                        <X className="size-4" />
                      </Button>
                      <Button
                        type="submit"
                        variant="outline"
                        size="sm"
                        aria-label="Submit feedback"
                        className="rounded-full bg-primary/10 hover:bg-primary/20 border-primary/20 text-primary hover:text-primary"
                        disabled={status === "submitting" || !feedback.trim()}
                      >
                        <AnimatePresence mode="popLayout">
                          {status === "submitting" ? (
                            <motion.span
                              key="submitting"
                              initial={{ opacity: 0, y: 5 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -5 }}
                              transition={TRANSITION_CONTENT}
                              className="inline-flex items-center gap-2"
                            >
                              <Spinner className="size-3 animate-spin" />
                              <span>Sending</span>
                            </motion.span>
                          ) : (
                            <motion.span
                              key="send"
                              initial={{ opacity: 0, y: 5 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -5 }}
                              transition={TRANSITION_CONTENT}
                            >
                              Send
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </Button>
                    </div>
                  </motion.form>
                )}
              </AnimatePresence>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}