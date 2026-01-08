
import React from "react";
import { render, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CronJobsList } from "@/components/cron-jobs-list";
import { vi, describe, it, expect, beforeEach } from "vitest";

// Mock PointerEvent for Radix UI
// @ts-ignore
window.PointerEvent = class PointerEvent extends Event {};
window.HTMLElement.prototype.scrollIntoView = vi.fn();
window.HTMLElement.prototype.releasePointerCapture = vi.fn();
window.HTMLElement.prototype.hasPointerCapture = vi.fn();

// Mock the CronJobDialog to avoid complex rendering and API calls within it
vi.mock("@/components/cron-job-dialog", () => ({
  CronJobDialog: ({ children }: any) => <div data-testid="cron-job-dialog">{children}</div>,
}));

// Mock toast
const mockToast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

describe("CronJobsList", () => {
  const mockCronJobs = [
    {
      id: "1",
      name: "Test Job",
      schedule: "0 0 * * *",
      repo: "owner/repo",
      branch: "main",
      enabled: true,
      lastRunAt: null,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn((url) => {
      if (url === '/api/cron-jobs') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockCronJobs),
        });
      }
      return Promise.resolve({ ok: false });
    }) as any;

    // Mock confirm
    global.confirm = vi.fn(() => true);
  });

  it("should render cron jobs", async () => {
    render(<CronJobsList />);
    await waitFor(() => expect(screen.getByText("Test Job")).toBeInTheDocument());
  });

  it("should show AlertDialog confirmation when delete is clicked", async () => {
    const user = userEvent.setup();
    render(<CronJobsList />);
    await waitFor(() => expect(screen.getByText("Test Job")).toBeInTheDocument());

    // Open dropdown menu
    const menuButton = screen.getByLabelText("Open menu");
    await user.click(menuButton);

    // Click delete
    const deleteButton = await screen.findByText("Delete");
    await user.click(deleteButton);

    // Check for AlertDialog
    expect(await screen.findByText("Are you absolutely sure?")).toBeInTheDocument();

    // Click confirm
    const confirmButton = screen.getByText("Delete", { selector: "button.bg-destructive" });
    await user.click(confirmButton);

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith("/api/cron-jobs/1", expect.objectContaining({ method: "DELETE" })));
  });
});
