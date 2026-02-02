"use client"

import type React from "react"
import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { cn } from "@repo/design-system/lib/utils"

export const GlowingStarsBackground = ({
  className,
  children,
}: {
  className?: string
  children?: React.ReactNode
}) => {
  return (
    <div className={cn("bg-black min-h-screen w-full relative", className)}>
      <div className="absolute inset-0 flex justify-center items-center">
        <Illustration />
      </div>
      <div className="relative z-10">{children}</div>
    </div>
  )
}

export const Illustration = () => {
  const stars = 432
  const columns = 36

  const [glowingStars, setGlowingStars] = useState<number[]>([])
  const highlightedStars = useRef<number[]>([])

  useEffect(() => {
    // Initial burst of stars
    highlightedStars.current = Array.from({ length: 20 }, () => Math.floor(Math.random() * stars))
    setGlowingStars([...highlightedStars.current])

    // Multiple staggered intervals with different timings for organic feel
    const intervals: NodeJS.Timeout[] = []

    // Primary wave - adds new stars every 1.5s
    intervals.push(
      setInterval(() => {
        const newStars = Array.from({ length: 8 }, () => Math.floor(Math.random() * stars))
        highlightedStars.current = [...highlightedStars.current.slice(-12), ...newStars]
        setGlowingStars([...highlightedStars.current])
      }, 1500),
    )

    // Secondary wave - adds stars every 2.3s (prime-ish number to avoid sync)
    intervals.push(
      setInterval(() => {
        const newStars = Array.from({ length: 5 }, () => Math.floor(Math.random() * stars))
        highlightedStars.current = [...highlightedStars.current.slice(-15), ...newStars]
        setGlowingStars([...highlightedStars.current])
      }, 2300),
    )

    // Tertiary wave - adds stars every 3.7s
    intervals.push(
      setInterval(() => {
        const newStars = Array.from({ length: 7 }, () => Math.floor(Math.random() * stars))
        highlightedStars.current = [...highlightedStars.current.slice(-10), ...newStars]
        setGlowingStars([...highlightedStars.current])
      }, 3700),
    )

    return () => intervals.forEach(clearInterval)
  }, [])

  return (
    <div
      className="h-full w-full p-4"
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap: `4px`,
      }}
    >
      {[...Array(stars)].map((_, starIdx) => {
        const isGlowing = glowingStars.includes(starIdx)
        const delay = (starIdx % 15) * 0.08 + Math.random() * 0.3
        return (
          <div key={`matrix-col-${starIdx}`} className="relative flex items-center justify-center">
            <Star isGlowing={isGlowing} delay={delay} />
            <AnimatePresence mode="wait">{isGlowing && <Glow delay={delay} />}</AnimatePresence>
          </div>
        )
      })}
    </div>
  )
}

const Star = ({ isGlowing, delay }: { isGlowing: boolean; delay: number }) => {
  return (
    <motion.div
      initial={{
        scale: 1,
      }}
      animate={{
        scale: isGlowing ? [1, 1.5, 2.5, 1.8, 1.2, 1] : 1,
        background: isGlowing ? "#fff" : "#666",
      }}
      transition={{
        duration: 2.5,
        ease: "easeInOut",
        delay: delay,
      }}
      className={cn("bg-[#666] h-[1px] w-[1px] rounded-full relative z-20")}
    />
  )
}

const Glow = ({ delay }: { delay: number }) => {
  return (
    <motion.div
      initial={{
        opacity: 0,
      }}
      animate={{
        opacity: [0, 0.8, 1, 0.6, 0],
      }}
      transition={{
        duration: 2.5,
        ease: "easeInOut",
        delay: delay,
      }}
      exit={{
        opacity: 0,
      }}
      className="absolute left-1/2 -translate-x-1/2 z-10 h-[4px] w-[4px] rounded-full bg-blue-500 blur-[1px] shadow-2xl shadow-blue-400"
    />
  )
}
