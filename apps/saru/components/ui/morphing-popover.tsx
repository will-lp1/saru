"use client"

import * as React from "react"
import { AnimatePresence, HTMLMotionProps, motion } from "framer-motion"

export interface MorphingPopoverProps {
  children: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
  className?: string
  transition?: any
}

const MorphingPopoverContext = React.createContext<{
  open: boolean
  setOpen: (open: boolean) => void
  transition: any
}>({
  open: false,
  setOpen: () => {},
  transition: {
    type: "spring",
    bounce: 0.15,
    duration: 0.4,
  },
})

export function MorphingPopover({
  children,
  open,
  onOpenChange,
  className,
  transition = {
    type: "spring",
    bounce: 0.15,
    duration: 0.4,
  },
}: MorphingPopoverProps) {
  const [internalOpen, setInternalOpen] = React.useState(open || false)

  const isControlled = open !== undefined
  const isOpen = isControlled ? open : internalOpen

  const setOpen = React.useCallback(
    (nextOpen: boolean) => {
      if (!isControlled) {
        setInternalOpen(nextOpen)
      }
      onOpenChange?.(nextOpen)
    },
    [isControlled, onOpenChange]
  )

  return (
    <MorphingPopoverContext.Provider value={{ open: isOpen, setOpen, transition }}>
      <div className={className}>{children}</div>
    </MorphingPopoverContext.Provider>
  )
}

interface MorphingPopoverTriggerProps extends HTMLMotionProps<"button"> {
  asChild?: boolean
  children: React.ReactNode
}

export function MorphingPopoverTrigger({
  asChild = false,
  children,
  onClick,
  ...props
}: MorphingPopoverTriggerProps) {
  const { open, setOpen, transition } = React.useContext(MorphingPopoverContext)
  
  const handleClick = React.useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      onClick?.(e)
      setOpen(!open)
    },
    [onClick, open, setOpen]
  )

  const Trigger = asChild ? React.Children.only(children) : 
    <motion.button
      type="button"
      {...props}
      onClick={handleClick}
      initial={{ scale: 1 }}
      animate={{ scale: open ? 0 : 1 }}
      transition={transition}
    >
      {children}
    </motion.button>

  return asChild ? (
    React.cloneElement(Trigger as React.ReactElement, {
      onClick: handleClick,
    })
  ) : (
    Trigger
  )
}

interface MorphingPopoverContentProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode
}

export function MorphingPopoverContent({
  children,
  ...props
}: MorphingPopoverContentProps) {
  const { open, transition } = React.useContext(MorphingPopoverContext)

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          {...props}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={transition}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
} 