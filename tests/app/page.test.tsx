import React from "react";
import { render, fireEvent, screen, act, within } from "@testing-library/react";
import Home from "@/app/page";
import { vi } from "vitest";
import * as localStorage from "@/hooks/use-local-storage";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
  useSearchParams: () => ({
    get: vi.fn(),
  }),
}));

const useLocalStorageSpy = vi.spyOn(localStorage, "useLocalStorage");

vi.mock("@/components/ui/combobox", () => ({
  Combobox: ({ options, selectedValue, onValueChange, placeholder }) => (
    <div>
      <div onClick={() => onValueChange('job-1')}>{selectedValue === 'job-1' ? 'Job 1' : placeholder}</div>
      {options.map(option => (
        <div key={option.value} onClick={() => onValueChange(option.value)}>
          {option.label}
        </div>
      ))}
    </div>
  )
}));

describe("Home page", () => {
  beforeEach(() => {
    useLocalStorageSpy.mockImplementation((key, initialValue) => {
      if (key === 'jules-jobs') {
        return [[{ id: 'job-1', name: 'Job 1', sessionIds: [], createdAt: new Date().toISOString() }], vi.fn()];
      }
      if (key === 'jules-sessions') {
        return [[], vi.fn()];
      }
      return [initialValue, vi.fn()];
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should render the component", async () => {
    await act(async () => {
      render(<Home />);
    });
    expect(screen.getByText("Jobs & Sessions")).toBeInTheDocument();
  });

  it('should update the job filter when a job is selected', async () => {
    let unmount;
    await act(async () => {
      const { unmount: u } = render(<Home />);
      unmount = u;
    });

    // Find combobox related to "Job Name"
    const jobNameLabel = screen.getByText("Job Name");
    const jobFilterGroup = jobNameLabel.closest('div');
    const jobFilter = within(jobFilterGroup).getByText('Filter by job...');

    await act(async () => {
      fireEvent.click(jobFilter);
    });

    expect(jobFilter).toHaveTextContent('Job 1');
    unmount();
  });
});
