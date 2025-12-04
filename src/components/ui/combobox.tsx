
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
    "data-testid"?: string;
};

function isGroupArray(options: ComboboxOption[] | ComboboxGroup[]): options is ComboboxGroup[] {
  return options.length > 0 && 'options' in options[0];
}

const MAX_DISPLAYED_OPTIONS = 50;

export function Combobox({ 
    options, 
    selectedValue, 
    onValueChange,
    placeholder,
    searchPlaceholder,
    disabled,
    icon,
    name,
    renderOption,
    "data-testid": dataTestId
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")

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

  const filteredGroups = React.useMemo(() => {
    const lowerSearch = search.toLowerCase();
    let count = 0;

    // If we have a selected value and no search, or if the search matches the selected value,
    // we want to make sure the selected value is included if possible.
    // However, simply limiting to top N is better for performance.
    // If the user searches, they will find their item.

    const result = [];

    for (const group of groups) {
        if (count >= MAX_DISPLAYED_OPTIONS) break;

        const filteredOptions = group.options.filter(option => {
             const match = option.label.toLowerCase().includes(lowerSearch) ||
                           (option.value && option.value.toLowerCase().includes(lowerSearch));
             return match;
        });

        if (filteredOptions.length > 0) {
            const remainingSpace = MAX_DISPLAYED_OPTIONS - count;
            const slicedOptions = filteredOptions.slice(0, remainingSpace);
            result.push({ ...group, options: slicedOptions });
            count += slicedOptions.length;
        }
    }

    return result;
  }, [groups, search]);

  return (
    <Popover open={open} onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) setSearch(""); // Reset search when closing
    }}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={disabled}
          name={name}
          data-testid={dataTestId}
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
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={searchPlaceholder}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <ScrollArea className="h-[200px]">
              {filteredGroups.length === 0 ? (
                 <CommandEmpty>No results found.</CommandEmpty>
              ) : (
                filteredGroups.map((group, groupIndex) => (
                    <CommandGroup key={groupIndex} heading={group.label}>
                    {group.options.map((option) => (
                        <CommandItem
                        key={option.value}
                        value={option.value}
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
                ))
              )}
            </ScrollArea>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
