"use client"

import * as React from "react"
import { format } from "date-fns"
import { CalendarIcon } from "lucide-react"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"

export function DatePicker({
  value,
  onChange,
  className,
}: {
  value?: string // YYYY-MM-DD
  onChange?: (date: string) => void
  className?: string
}) {
  const dateValue = value ? new Date(value) : undefined

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal h-9 px-3 shadow-none border bg-background hover:bg-secondary/50",
              !value && "text-muted-foreground",
              className
            )}
          >
            <CalendarIcon className="mr-2 size-4 text-muted-foreground shrink-0" />
            {dateValue ? format(dateValue, "PPP") : <span>Pick a date</span>}
          </Button>
        }
      />
      <PopoverContent className="w-auto p-0 border shadow-md bg-popover text-popover-foreground">
        <Calendar
          mode="single"
          selected={dateValue}
          onSelect={(d) => {
            if (d && onChange) {
              const offset = d.getTimezoneOffset()
              const localDate = new Date(d.getTime() - offset * 60 * 1000)
              onChange(localDate.toISOString().split("T")[0])
            }
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
