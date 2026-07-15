"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { SearchIcon } from "lucide-react"

import {
  globalSearchAction,
  type GlobalSearchResult,
} from "@/app/(app)/global-search/actions"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export function GlobalSearch() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<GlobalSearchResult[]>([])
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setOpen((value) => !value)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      return
    }

    const timer = window.setTimeout(() => {
      startTransition(async () => {
        const result = await globalSearchAction(trimmed)
        setResults(result.ok ? result.data : [])
      })
    }, 180)

    return () => window.clearTimeout(timer)
  }, [query])

  function updateQuery(value: string) {
    setQuery(value)
    if (value.trim().length < 2) {
      setResults([])
    }
  }

  function go(result: GlobalSearchResult) {
    setOpen(false)
    setQuery("")
    setResults([])
    router.push(result.href)
  }

  return (
    <>
      <SidebarGroup>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Search" onClick={() => setOpen(true)}>
              <SearchIcon />
              <span>Search</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroup>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Search"
        description="Search products, contacts, sales, purchases, and payments."
      >
        <Command shouldFilter={false}>
          <CommandInput
            value={query}
            onValueChange={updateQuery}
            placeholder="Search products, contacts, bills..."
          />
          <CommandList>
            <CommandEmpty>
              {query.trim().length < 2
                ? "Type at least 2 characters."
                : isPending
                  ? "Searching..."
                  : "No results found."}
            </CommandEmpty>
            {results.length ? (
              <CommandGroup heading="Results">
                {results.map((result) => (
                  <CommandItem key={result.id} value={result.id} onSelect={() => go(result)}>
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate font-medium">{result.title}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {result.subtitle}
                      </span>
                    </div>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {result.kind}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
            <CommandSeparator />
            <CommandGroup heading="Pages">
              {[
                ["Overview", "/dashboard"],
                ["Products", "/products"],
                ["Contacts", "/contact"],
                ["Sales", "/sales"],
                ["Purchases", "/purchases"],
                ["Payments", "/payments"],
                ["Reports", "/reports"],
              ].map(([title, href]) => (
                <CommandItem
                  key={href}
                  value={`page-${title}`}
                  onSelect={() => {
                    setOpen(false)
                    router.push(href)
                  }}
                >
                  {title}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  )
}
