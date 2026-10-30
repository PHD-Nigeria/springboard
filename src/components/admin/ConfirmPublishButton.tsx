"use client";

import { useRef, useState, type ReactNode } from "react";
import { AdminButton } from "@/components/admin/ui";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";

interface ConfirmPublishButtonProps {
  children: ReactNode;
  /** Pass the form's `pending` flag so the button and dialog lock while a save is running. */
  disabled?: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  /** The field the form's server action reads to decide what to do; defaults to the Publish intent every form already uses. */
  name?: string;
  value?: string;
}

/**
 * A "Publish" button that asks first. For forms that submit through `<form action={...}>` and read a named submit
 * button (`intent=publish`), where the old button published the moment it was clicked.
 *
 * It checks the form with the browser's own validation first, so a form that is not valid shows its usual messages
 * instead of an irrelevant "are you sure?". On confirm it submits the form with a hidden submit button carrying the same
 * name/value as before, so the server action receives exactly what it always did — nothing about the action changes.
 * Cancel (or Escape) leaves the form and the story untouched.
 */
export function ConfirmPublishButton({ children, disabled, title, description, confirmLabel = "Publish now", name = "intent", value = "publish" }: ConfirmPublishButtonProps) {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);
  const submitRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <AdminButton
        type="button"
        disabled={disabled}
        onClick={(event) => {
          const form = event.currentTarget.form;
          if (!form || !form.reportValidity()) return;
          formRef.current = form;
          setOpen(true);
        }}
      >
        {children}
      </AdminButton>
      <button ref={submitRef} type="submit" name={name} value={value} hidden tabIndex={-1} aria-hidden="true" />
      <ConfirmDialog
        open={open}
        pending={disabled}
        title={title}
        description={description}
        confirmLabel={confirmLabel}
        onCancel={() => setOpen(false)}
        onConfirm={() => {
          setOpen(false);
          formRef.current?.requestSubmit(submitRef.current);
        }}
      />
    </>
  );
}
