"use client"

import { useEffect, useRef } from "react"
import { useActionState } from "react"
import { SendIcon } from "lucide-react"
import { toast } from "sonner"

import {
  createContactInquiryAction,
  initialContactInquiryFormState,
} from "@/app/architecture/contact/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export function ContactInquiryForm() {
  const formRef = useRef<HTMLFormElement>(null)
  const [state, formAction, pending] = useActionState(
    createContactInquiryAction,
    initialContactInquiryFormState
  )

  useEffect(() => {
    if (!state.submittedAt) {
      return
    }

    if (state.status === "success") {
      toast.success(state.message)
      formRef.current?.reset()
      return
    }

    if (state.status === "error") {
      toast.error(state.message)
    }
  }, [state])

  return (
    <form ref={formRef} action={formAction} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            name="name"
            placeholder="Your name"
            required
            className="h-11 bg-background/60 shadow-none"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Contact number</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            placeholder="Phone number"
            required
            className="h-11 bg-background/60 shadow-none"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="city">City</Label>
          <Input
            id="city"
            name="city"
            placeholder="City"
            required
            className="h-11 bg-background/60 shadow-none"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pincode">Pincode</Label>
          <Input
            id="pincode"
            name="pincode"
            inputMode="numeric"
            placeholder="Pincode"
            className="h-11 bg-background/60 shadow-none"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="message">Message</Label>
        <Textarea
          id="message"
          name="message"
          placeholder="Tell us about the site, scope, or space you want to design."
          required
          className="min-h-36 bg-background/60 shadow-none"
        />
      </div>

      <Button type="submit" size="lg" disabled={pending} className="w-full">
        <SendIcon className="size-4" />
        {pending ? "Sending" : "Send inquiry"}
      </Button>
    </form>
  )
}
