"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"

type Theme = "light" | "dark" | "system"

type ThemeContextValue = {
  theme: Theme
  resolvedTheme: "light" | "dark"
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "system",
  resolvedTheme: "light",
  setTheme: () => {},
})

function getSystemTheme() {
  if (typeof window === "undefined") return "light"
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light"
}

function storedTheme(): Theme {
  if (typeof window === "undefined") return "system"
  const value = window.localStorage.getItem("theme")
  return value === "light" || value === "dark" || value === "system"
    ? value
    : "system"
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(storedTheme)
  const [systemTheme, setSystemTheme] = useState<"light" | "dark">(getSystemTheme)
  const resolvedTheme = theme === "system" ? systemTheme : theme

  const applyTheme = useCallback((nextTheme: "light" | "dark") => {
    const root = document.documentElement
    root.classList.toggle("dark", nextTheme === "dark")
    root.style.colorScheme = nextTheme
  }, [])

  useEffect(() => {
    applyTheme(resolvedTheme)
  }, [applyTheme, resolvedTheme])

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)")
    const onChange = () => {
      const nextSystemTheme = getSystemTheme()
      setSystemTheme(nextSystemTheme)
      if (storedTheme() === "system") {
        applyTheme(nextSystemTheme)
      }
    }

    media.addEventListener("change", onChange)
    return () => media.removeEventListener("change", onChange)
  }, [applyTheme])

  const setTheme = useCallback(
    (nextTheme: Theme) => {
      window.localStorage.setItem("theme", nextTheme)
      setThemeState(nextTheme)
      applyTheme(nextTheme === "system" ? getSystemTheme() : nextTheme)
    },
    [applyTheme]
  )

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme]
  )

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
