
"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

type ComboboxProps = {
    options: { value: string; label: string; [key: string]: any }[];
    selectedValue?: string | null;
    onValueChange: (value: string | null) => void;
    placeholder: string;
    searchPlaceholder: string;
    disabled?: boolean;
    icon?: React.ReactNode;
    name?: string;
};

export function Combobox({ 
    options, 
    selectedValue, 
    onValueChange,
    placeholder,
    searchPlaceholder,
    disabled,
    icon,
    name
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={disabled}
          name={name}
        >
            <div className="flex items-center gap-2 truncate">
                {icon}
                <span className="truncate">
                    {selectedValue
                        ? options.find((option) => option.value === selectedValue)?.label
                        : placeholder}
                </span>
            </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={`${option.value} ${option.label} ${option.content || ''}`}
                  onSelect={(currentValue) => {
                    // Find the option by its value, which is what we get from onSelect
                    const selectedOption = options.find(o => `${o.value} ${o.label} ${o.content || ''}` === currentValue);
                    onValueChange(selectedOption ? selectedOption.value : null)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selectedValue === option.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
