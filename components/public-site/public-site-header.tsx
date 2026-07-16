"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion } from "motion/react"

export function PublicSiteHeader({ heroAware = false }: { heroAware?: boolean }) {
  const pathname = usePathname()
  const [isHeroHeader, setIsHeroHeader] = useState(heroAware)
  const [isHeaderVisible, setIsHeaderVisible] = useState(true)

  useEffect(() => {
    let lastScrollY = window.scrollY

    const updateHeader = () => {
      const currentScrollY = window.scrollY
      const scrollDelta = currentScrollY - lastScrollY

      setIsHeroHeader(heroAware && currentScrollY < window.innerHeight - 96)

      if (currentScrollY < 24) {
        setIsHeaderVisible(true)
      } else if (scrollDelta > 22) {
        setIsHeaderVisible(false)
      } else if (scrollDelta < -16) {
        setIsHeaderVisible(true)
      }

      lastScrollY = currentScrollY
    }

    updateHeader()
    window.addEventListener("scroll", updateHeader, { passive: true })
    window.addEventListener("resize", updateHeader)

    return () => {
      window.removeEventListener("scroll", updateHeader)
      window.removeEventListener("resize", updateHeader)
    }
  }, [heroAware])

  function scrollToProjects() {
    const projectsSection = document.getElementById("projects")

    if (!projectsSection || pathname !== "/") {
      window.location.href = "/#projects"
      return
    }

    projectsSection.scrollIntoView({ behavior: "smooth", block: "start" })
    window.history.replaceState(null, "", "#projects")
  }

  return (
    <motion.header
      initial={{ opacity: 0, y: -12 }}
      animate={{
        opacity: isHeaderVisible ? 1 : 0,
        y: isHeaderVisible ? 0 : -72,
      }}
      transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
      className="fixed inset-x-0 top-0 z-50 px-5 pt-5 sm:px-8 lg:px-12"
    >
      <div
        className={`mx-auto flex h-14 max-w-7xl items-center justify-between rounded-full border px-3 shadow-sm backdrop-blur-md transition-colors duration-300 sm:px-4 ${
          isHeroHeader
            ? "border-primary-foreground/25 bg-primary-foreground/10 text-primary-foreground"
            : "border-border/70 bg-background/75 text-foreground shadow-md"
        }`}
      >
        <Link
          href="/"
          className="inline-flex min-w-0 items-center px-2 text-sm font-semibold tracking-wide"
        >
          <span className="truncate">JR SUTHAR & DESIGNS</span>
        </Link>

        <nav className="hidden items-center gap-1 sm:flex">
          <button
            type="button"
            onClick={scrollToProjects}
            className={`inline-flex h-9 items-center rounded-full px-4 text-sm font-medium transition-colors ${
              isHeroHeader
                ? "text-primary-foreground/75 hover:bg-primary-foreground/10 hover:text-primary-foreground"
                : "text-foreground/65 hover:bg-secondary/80 hover:text-foreground"
            }`}
          >
            PROJECTS
          </button>
          <Link
            href="/architecture"
            className={`inline-flex h-9 items-center rounded-full px-4 text-sm font-medium transition-colors ${
              isHeroHeader
                ? "text-primary-foreground/75 hover:bg-primary-foreground/10 hover:text-primary-foreground"
                : "text-foreground/65 hover:bg-secondary/80 hover:text-foreground"
            }`}
          >
            STUDIO
          </Link>
        </nav>

        <Link
          href="/architecture/contact"
          className={`inline-flex h-9 shrink-0 items-center rounded-full border px-4 text-sm font-semibold backdrop-blur-md transition-colors ${
            isHeroHeader
              ? "border-primary-foreground/25 bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20"
              : "border-border/70 bg-background/70 text-foreground hover:bg-secondary"
          }`}
        >
          CONTACT
        </Link>
      </div>
    </motion.header>
  )
}
