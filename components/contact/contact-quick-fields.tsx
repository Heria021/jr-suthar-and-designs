"use client"

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
    const contactId =
      selected && nextPhone !== (selected.phone ?? "") ? "" : selectedId
    onChange({
      name,
      phone: nextPhone,
      address,
      contactId,
    })
  }

  function patchAddress(nextAddress: string) {
    const contactId =
      selected && nextAddress !== (selected.address ?? "") ? "" : selectedId
    onChange({
      name,
      phone,
      address: nextAddress,
      contactId,
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

      {!selected && name.trim() ? (
        <p className="text-xs text-muted-foreground">
          New {kind} will be created when you submit.
        </p>
      ) : null}
    </div>
  )
}
