
import React from "react";
import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import SettingsPage from "@/app/settings/page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
  useSearchParams: () => ({
    get: () => "profiles",
  }),
  usePathname: () => "/",
}));

describe("SettingsPage Rendering", () => {
  it("should render something", () => {
    render(<SettingsPage />);
    screen.debug();
  });
});
