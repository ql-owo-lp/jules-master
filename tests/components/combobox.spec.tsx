
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Combobox } from "@/components/ui/combobox";
import { vi } from "vitest";

const options = [
  { value: "1", label: "Option 1" },
  { value: "2", label: "Option 2" },
  { value: "3", label: "Option 3" },
];

describe("Combobox", () => {
  it("should render with the correct initial value", () => {
    render(
      <Combobox
        options={options}
        selectedValue="1"
        onValueChange={() => {}}
        placeholder="Select an option"
        searchPlaceholder="Search..."
      />
    );

    expect(screen.getByText("Option 1")).toBeInTheDocument();
  });

  it("should open the popover when the button is clicked", async () => {
    const user = userEvent.setup();
    render(
      <Combobox
        options={options}
        selectedValue={null}
        onValueChange={() => {}}
        placeholder="Select an option"
        searchPlaceholder="Search..."
      />
    );

    await user.click(screen.getByRole("combobox"));

    expect(screen.getByPlaceholderText("Search...")).toBeInTheDocument();
  });

  it("should call onValueChange with the correct value when an option is selected", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <Combobox
        options={options}
        selectedValue={null}
        onValueChange={onValueChange}
        placeholder="Select an option"
        searchPlaceholder="Search..."
      />
    );

    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByText("Option 2"));

    expect(onValueChange).toHaveBeenCalledWith("2");
  });

  it("should set the correct value for CommandItem", async () => {
    const user = userEvent.setup();
    render(
      <Combobox
        options={options}
        selectedValue={null}
        onValueChange={() => {}}
        placeholder="Select an option"
        searchPlaceholder="Search..."
      />
    );

    await user.click(screen.getByRole("combobox"));

    const commandItems = screen.getAllByRole("option");
    commandItems.forEach((item, index) => {
      expect(item.getAttribute("data-value")).toBe(options[index].value);
    });
  });
});
