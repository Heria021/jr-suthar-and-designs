"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import {
  Building2Icon,
  ChartNoAxesCombinedIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  MessagesSquareIcon,
  MoonIcon,
  PackageIcon,
  ReceiptTextIcon,
  ShoppingCartIcon,
  StoreIcon,
  SunIcon,
  TruckIcon,
  UsersIcon,
  WalletCardsIcon,
} from "lucide-react"
import { useTheme } from "next-themes"

import { signOut } from "@/app/auth/actions"
import { GlobalSearch } from "@/components/global-search"
import { NavMain } from "@/components/nav-main"
import { TeamSwitcher } from "@/components/team-switcher"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

const data = {
  teams: [
    {
      key: "narayani",
      name: "Narayani Traders ERP",
      logo: <StoreIcon className="size-4" />,
      plan: "Owner workspace",
      href: "/dashboard",
    },
    {
      key: "jr-suthar",
      name: "JR Suthar & Designs",
      logo: <Building2Icon className="size-4" />,
      plan: "Design workspace",
      href: "/jr-suthar-and-designs",
    },
  ],
  erpNav: [
    {
      title: "Overview",
      url: "/dashboard",
      icon: <LayoutDashboardIcon />,
      exact: true,
    },
    {
      title: "Products",
      url: "/products",
      icon: <PackageIcon />,
    },
    {
      title: "Contacts",
      url: "/contact",
      icon: <UsersIcon />,
    },
    {
      title: "Invoices",
      url: "/invoices",
      icon: <ReceiptTextIcon />,
      disabled: true,
    },
    {
      title: "Sales",
      url: "/sales",
      icon: <ShoppingCartIcon />,
    },
    {
      title: "Purchases",
      url: "/purchases",
      icon: <TruckIcon />,
    },
    {
      title: "Payments",
      url: "/payments",
      icon: <WalletCardsIcon />,
    },
    {
      title: "Reports",
      url: "/reports",
      icon: <ChartNoAxesCombinedIcon />,
    },
  ],
  jrNav: [
    {
      title: "Overview",
      url: "/jr-suthar-and-designs",
      icon: <LayoutDashboardIcon />,
      exact: true,
    },
    {
      title: "Contact",
      url: "/jr-suthar-and-designs/contact",
      icon: <MessagesSquareIcon />,
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  const { resolvedTheme, setTheme } = useTheme()
  const isDark = resolvedTheme === "dark"
  const routeWorkspaceKey = pathname.startsWith("/jr-suthar-and-designs")
    ? "jr-suthar"
    : "narayani"
  const [workspaceKey, setWorkspaceKey] =
    React.useOptimistic(routeWorkspaceKey)
  const isJrWorkspace = workspaceKey === "jr-suthar"
  const navItems = isJrWorkspace ? data.jrNav : data.erpNav

  return (
    <Sidebar collapsible="icon" variant="sidebar" {...props}>
      <SidebarHeader>
        <TeamSwitcher
          teams={data.teams}
          activeTeamKey={workspaceKey}
          onTeamChange={setWorkspaceKey}
        />
      </SidebarHeader>
      <SidebarContent className="transition-opacity duration-200">
        <Separator />
        {!isJrWorkspace ? (
          <>
            <GlobalSearch />
            <Separator />
          </>
        ) : null}
        <NavMain items={navItems} label={isJrWorkspace ? "Studio" : "ERP"} />
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip={isDark ? "Switch to light theme" : "Switch to dark theme"}
              onClick={() => setTheme(isDark ? "light" : "dark")}
            >
              {isDark ? <SunIcon /> : <MoonIcon />}
              <span>Theme</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <form action={signOut}>
              <SidebarMenuButton
                tooltip="Log out"
                render={
                  <Button
                    type="submit"
                    variant="ghost"
                    className="h-8 w-full justify-start px-2"
                  />
                }
              >
                <LogOutIcon />
                <span>Log out</span>
              </SidebarMenuButton>
            </form>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
