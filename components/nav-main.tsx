"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export function NavMain({
  items,
  label = "ERP",
}: {
  items: {
    title: string
    url: string
    icon?: React.ReactNode
    disabled?: boolean
    exact?: boolean
  }[]
  label?: string
}) {
  const pathname = usePathname()

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => {
          const isActive = item.exact
            ? pathname === item.url
            : item.url === "/"
              ? pathname === item.url
              : pathname === item.url || pathname.startsWith(`${item.url}/`)

          return (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                disabled={item.disabled}
                isActive={!item.disabled && isActive}
                tooltip={
                  item.disabled ? `${item.title} - coming soon` : item.title
                }
                render={item.disabled ? undefined : <Link href={item.url} />}
                className={item.disabled ? "opacity-55" : undefined}
              >
                {item.icon}
                <span>{item.title}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}
