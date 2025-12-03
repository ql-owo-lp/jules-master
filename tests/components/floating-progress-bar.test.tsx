
import React from "react";
import { render, screen } from "@testing-library/react";
import { FloatingProgressBar } from "@/components/floating-progress-bar";
import { describe, it, expect } from "vitest";
import '@testing-library/jest-dom/vitest';

describe("FloatingProgressBar", () => {
  it("should not render when total is 0", () => {
    render(
      <FloatingProgressBar
        current={0}
        total={0}
        label="Processing"
        isVisible={true}
      />
    );
    expect(screen.queryByText("Processing")).toBeNull();
  });

  it("should render when total is greater than 0", () => {
    render(
      <FloatingProgressBar
        current={1}
        total={10}
        label="Processing"
        isVisible={true}
      />
    );
    expect(screen.getByText("Processing")).toBeInTheDocument();
    expect(screen.getByText("1 / 10")).toBeInTheDocument();
  });

  it("should not render when isVisible is false", () => {
    render(
      <FloatingProgressBar
        current={1}
        total={10}
        label="Processing"
        isVisible={false}
      />
    );
    expect(screen.queryByText("Processing")).toBeNull();
  });
});
