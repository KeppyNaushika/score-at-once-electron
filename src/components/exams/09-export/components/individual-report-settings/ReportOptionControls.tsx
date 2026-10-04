import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"

export function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
      </h4>
      {children}
    </div>
  )
}

export function OptionCard({
  label,
  checked,
  onChange,
  variant = "default",
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  variant?: "default" | "sub"
}) {
  const baseClasses =
    "flex items-center gap-2 rounded-lg border p-2 cursor-pointer"
  const variantClasses =
    variant === "sub"
      ? checked
        ? "bg-primary/5 border-primary/30"
        : "bg-muted/50 border-muted"
      : checked
        ? "bg-primary/5 border-primary"
        : "bg-background hover:bg-muted/50"

  return (
    <div
      className={`${baseClasses} ${variantClasses}`}
      onClick={() => onChange(!checked)}
    >
      <Checkbox
        checked={checked}
        onCheckedChange={(value) => onChange(value === true)}
        onClick={(e) => e.stopPropagation()}
      />
      <Label className="cursor-pointer text-xs">{label}</Label>
    </div>
  )
}

export function OptionCardWithChildren({
  label,
  checked,
  onChange,
  children,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  children?: React.ReactNode
}) {
  return (
    <div
      className={`rounded-lg border p-2 ${
        checked ? "border-primary bg-primary/5" : "bg-background"
      }`}
    >
      <div
        className="flex cursor-pointer items-center gap-2"
        onClick={() => onChange(!checked)}
      >
        <Checkbox
          checked={checked}
          onCheckedChange={(value) => onChange(value === true)}
          onClick={(e) => e.stopPropagation()}
        />
        <Label className="cursor-pointer text-xs">{label}</Label>
      </div>
      {children}
    </div>
  )
}
