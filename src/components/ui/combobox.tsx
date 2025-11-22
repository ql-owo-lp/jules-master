
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
import { ScrollArea } from "./scroll-area"

type ComboboxOption = { value: string; label: string; [key: string]: any };

export type ComboboxGroup = {
  label?: string;
  options: ComboboxOption[];
};

type ComboboxProps = {
    options: ComboboxOption[] | ComboboxGroup[];
    selectedValue?: string | null;
    onValueChange: (value: string | null) => void;
    placeholder: string;
    searchPlaceholder: string;
    disabled?: boolean;
    icon?: React.ReactNode;
    name?: string;
    renderOption?: (option: ComboboxOption) => React.ReactNode;
};

function isGroupArray(options: ComboboxOption[] | ComboboxGroup[]): options is ComboboxGroup[] {
  return options.length > 0 && 'options' in options[0];
}

export function Combobox({ 
    options, 
    selectedValue, 
    onValueChange,
    placeholder,
    searchPlaceholder,
    disabled,
    icon,
    name,
    renderOption
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)

  const flattenedOptions = React.useMemo(() => {
    if (isGroupArray(options)) {
      return options.flatMap(g => g.options);
    }
    return options;
  }, [options]);

  const groups = React.useMemo(() => {
    if (isGroupArray(options)) {
      return options;
    }
    return [{ label: undefined, options }];
  }, [options]);

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
                        ? flattenedOptions.find((option) => option.value === selectedValue)?.label
                        : placeholder}
                </span>
            </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command filter={(value, search) => {
            const compositeValue = value.toLowerCase();
            const searchValue = search.toLowerCase();
            if (compositeValue.includes(searchValue)) return 1
            return 0
          }}>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <ScrollArea className="h-[200px]">
              <CommandEmpty>No results found.</CommandEmpty>
              {groups.map((group, groupIndex) => (
                <CommandGroup key={groupIndex} heading={group.label}>
                  {group.options.map((option) => (
                    <CommandItem
                      key={option.value}
                      value={`${option.label} ${option.content || ''}`}
                      onSelect={() => {
                        onValueChange(option.value === selectedValue ? null : option.value)
                        setOpen(false)
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          selectedValue === option.value ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {renderOption ? renderOption(option) : option.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
            </ScrollArea>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
