import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-10 w-full min-w-0 rounded-[10px] px-3.5 py-2 text-sm outline-none transition-all duration-150",
        "file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-[#1B263B]",
        "placeholder:text-[#778DA9]",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:shadow-[0_0_0_3px_rgba(192,57,43,0.10)]",
        className
      )}
      style={{
        background: 'rgba(255,255,255,0.75)',
        border: '1px solid rgba(65,90,119,0.20)',
        color: '#1B263B',
      }}
      onFocus={(e) => {
        ;(e.currentTarget as HTMLElement).style.borderColor = '#415A77'
        ;(e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.95)'
        ;(e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 3px rgba(65,90,119,0.12)'
        props.onFocus?.(e as React.FocusEvent<HTMLInputElement>)
      }}
      onBlur={(e) => {
        ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(65,90,119,0.20)'
        ;(e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.75)'
        ;(e.currentTarget as HTMLElement).style.boxShadow = 'none'
        props.onBlur?.(e as React.FocusEvent<HTMLInputElement>)
      }}
      {...props}
    />
  )
}

export { Input }
