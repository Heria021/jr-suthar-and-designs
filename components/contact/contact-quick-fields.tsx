"use client"

import { CheckIcon } from "lucide-react"

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export type QuickContactOption = {
  id: string
  name: string
  phone: string | null
  address?: string | null
  contact_type: string
}

export function ContactQuickFields({
  label,
  kind,
  options,
  name,
  phone,
  address,
  selectedId,
  onChange,
}: {
  label: string
  kind: "customer" | "supplier"
  options: QuickContactOption[]
  name: string
  phone: string
  address: string
  selectedId: string
  onChange: (value: { name: string; phone: string; address: string; contactId: string }) => void
}) {
  const selected = options.find((option) => option.id === selectedId)

  function patchName(nextName: string) {
    const exact = options.find(
      (option) =>
        option.name.trim().toLowerCase() === nextName.trim().toLowerCase()
    )

    onChange({
      name: nextName,
      phone: exact?.phone ?? phone,
      address: exact?.address ?? address,
      contactId: exact?.id ?? "",
    })
  }

  function patchPhone(nextPhone: string) {
    onChange({
      name,
      phone: nextPhone,
      address,
      contactId: selectedId,
    })
  }

  function patchAddress(nextAddress: string) {
    onChange({
      name,
      phone,
      address: nextAddress,
      contactId: selectedId,
    })
  }

  function selectContact(contact: QuickContactOption | null) {
    if (!contact) {
      onChange({
        name: "",
        phone: "",
        address: "",
        contactId: "",
      })
      return
    }

    onChange({
      name: contact.name,
      phone: contact.phone ?? "",
      address: contact.address ?? "",
      contactId: contact.id,
    })
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>{label} name</Label>
          <Combobox<QuickContactOption>
            items={options}
            value={selected ?? null}
            inputValue={name}
            itemToStringLabel={(contact) => contact.name}
            itemToStringValue={(contact) => contact.id}
            isItemEqualToValue={(item, value) => item.id === value.id}
            onInputValueChange={patchName}
            onValueChange={selectContact}
          >
            <ComboboxInput
              placeholder={`Type ${kind} name`}
              showClear
              className="w-full shadow-none"
            />
            {name.trim() ? (
              <ComboboxContent>
                <ComboboxEmpty>No {kind} found. Keep typing to create new.</ComboboxEmpty>
                <ComboboxList>
                  {(contact: QuickContactOption) => (
                    <ComboboxItem key={contact.id} value={contact}>
                      <span className="min-w-0 flex-1 truncate">
                        {contact.name}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {contact.phone ?? "No phone"}
                      </span>
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxContent>
            ) : null}
          </Combobox>
        </div>
        <div className="space-y-2">
          <Label>Phone</Label>
          <Input
            value={phone}
            onChange={(event) => patchPhone(event.target.value)}
            placeholder="Optional"
            className="shadow-none"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Address</Label>
        <Textarea
          value={address}
          onChange={(event) => patchAddress(event.target.value)}
          placeholder="Optional"
          className="min-h-20 w-full shadow-none"
        />
      </div>

      {selected ? (
        <div className="flex items-center gap-2 rounded-md border bg-secondary/50 px-3 py-2 text-sm">
          <CheckIcon className="size-4 text-emerald-600" />
          <span className="font-medium">{selected.name}</span>
          <span className="text-muted-foreground">
            {selected.phone ?? "No phone"}
          </span>
        </div>
      ) : name.trim() ? (
        <p className="text-xs text-muted-foreground">
          New {kind} will be created when you submit.
        </p>
      ) : null}
    </div>
  )
}
