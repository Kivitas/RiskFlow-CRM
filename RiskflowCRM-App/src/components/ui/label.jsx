import * as React from "react"
import * as LabelPrimitive from "@radix-ui/react-label"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

const labelVariants = cva(
  "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
)

const Label = React.forwardRef(({ className, ...props }, ref) => (
  <LabelPrimitive.Root ref={ref} className={cn(labelVariants(), className)} {...props} />
))
Label.displayName = LabelPrimitive.Root.displayName

// Inline, screen-reader-announced field error. Renders nothing when there is no message.
const FieldError = ({ id, children }) =>
  children ? (
    <p id={id} role="alert" className="mt-1 text-xs text-destructive">
      {children}
    </p>
  ) : null

export { Label, FieldError }
