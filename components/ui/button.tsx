import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center whitespace-nowrap font-medium transition-all duration-150 outline-none select-none active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-[#1B263B] text-[#E0E1DD] border border-[#1B263B] rounded-[10px] hover:bg-[#0D1B2A] hover:shadow-[0_4px_12px_rgba(13,27,42,0.25)] focus-visible:ring-2 focus-visible:ring-[#415A77]/40",
        outline:
          "bg-white/70 text-[#1B263B] border border-[#415A77]/25 rounded-[10px] hover:bg-white/90 hover:border-[#415A77] focus-visible:ring-2 focus-visible:ring-[#415A77]/30",
        secondary:
          "bg-white/70 text-[#1B263B] border border-[#415A77]/25 rounded-[10px] hover:bg-white/90 hover:border-[#415A77] focus-visible:ring-2 focus-visible:ring-[#415A77]/30",
        ghost:
          "text-[#415A77] bg-transparent border-0 rounded-[8px] hover:bg-[#415A77]/8 focus-visible:ring-2 focus-visible:ring-[#415A77]/20",
        destructive:
          "bg-transparent text-[#C0392B] border border-[#C0392B]/30 rounded-[10px] hover:bg-[#C0392B]/6 focus-visible:ring-2 focus-visible:ring-[#C0392B]/20",
        link: "text-[#415A77] underline-offset-4 hover:underline bg-transparent border-0",
      },
      size: {
        default: "h-[38px] gap-1.5 px-[18px] text-sm",
        xs:      "h-6  gap-1   rounded-[8px]  px-2    text-xs  [&_svg:not([class*='size-'])]:size-3",
        sm:      "h-8  gap-1   rounded-[9px]  px-2.5  text-[0.8rem] [&_svg:not([class*='size-'])]:size-3.5",
        lg:      "h-11 gap-1.5 px-5           text-sm",
        icon:    "size-9 rounded-[10px]",
        "icon-xs": "size-6 rounded-[8px] [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8 rounded-[9px] [&_svg:not([class*='size-'])]:size-3.5",
        "icon-lg": "size-10 rounded-[10px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
