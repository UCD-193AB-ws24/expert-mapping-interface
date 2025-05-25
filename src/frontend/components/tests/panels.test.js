/**
 * @jest-environment jsdom
 */

import React from "react";
import "@testing-library/jest-dom"; // Import for `toBeInTheDocument`
import { render, screen, fireEvent, within } from "@testing-library/react"; // Added `within`
import { WorksPanel, GrantsPanel, CombinedPanel } from "../rendering/Panels";

describe("WorksPanel", () => {
  const mockOnClose = jest.fn();
  const mockWorks = [
    {
      name: "California",
      works: [
        {
          title: "Hypoparathyroidism After Total Thyroidectomy: A Population-Based Analysis of California Databases",
          issued: "2025-06",
          confidence: "91.8",
          authors: [
            "Alexis L Woods",
            "Yueju Li",
            "Theresa H Keegan",
            "Miriam Nuño",
            "Claire E Graves",
            "Michael J Campbell",
          ],
          abstract: "INTRODUCTION: Postthyroidectomy hypoparathyroidism is common...",
        },
        {
          title: "Community-acquired Staphylococcus aureus skin and soft tissue infection risk assessment...",
          issued: "2024-01-09",
          confidence: "91.8",
          authors: ["Beatriz Martínez-López"],
          abstract: "BACKGROUND: Community-acquired Staphylococcus aureus (CA-Sa)...",
        },
      ],
      url: "http://example.com/california",
    },
  ];

  it("renders correctly with works", () => {
    render(<WorksPanel works={mockWorks} onClose={mockOnClose} />);
    expect(screen.getByText(/1 Expert at this Location/i)).toBeInTheDocument();
    expect(screen.getByText("California")).toBeInTheDocument();
    expect(screen.getByText(/Hypoparathyroidism After Total Thyroidectomy/i)).toBeInTheDocument();
  });

  it("calls onClose when the close button is clicked", () => {
    render(<WorksPanel works={mockWorks} onClose={mockOnClose} />);
    fireEvent.click(screen.getByText("×"));
    expect(mockOnClose).toHaveBeenCalled();
  });

  it("toggles visibility of additional works", () => {
    render(<WorksPanel works={mockWorks} onClose={mockOnClose} />);
    fireEvent.click(screen.getByText("Show More Works"));
    expect(screen.getByText(/Community-acquired Staphylococcus aureus/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText("Hide More Works"));
    expect(screen.queryByText(/Community-acquired Staphylococcus aureus/i)).not.toBeInTheDocument();
  });
});

describe("GrantsPanel", () => {
  const mockOnClose = jest.fn();
  const mockGrants = [
    {
      name: "California",
      grants: [
        {
          title: "Grant 1",
          funder: "Funder 1",
          startDate: "2020",
          endDate: "2021",
          confidence: "High",
        },
        {
          title: "Grant 2",
          funder: "Funder 2",
          startDate: "2022",
          endDate: "2023",
          confidence: "Low",
        },
      ],
      url: "http://example.com/california",
    },
  ];

  it("renders correctly with grants", () => {
    render(<GrantsPanel grants={mockGrants} onClose={mockOnClose} />);
    expect(screen.getByText(/1 Expert at this Location/i)).toBeInTheDocument();
    expect(screen.getByText("California")).toBeInTheDocument();
    expect(screen.getByText(/Grant 1/i)).toBeInTheDocument();
  });

  it("calls onClose when the close button is clicked", () => {
    render(<GrantsPanel grants={mockGrants} onClose={mockOnClose} />);
    fireEvent.click(screen.getByText("×"));
    expect(mockOnClose).toHaveBeenCalled();
  });

  it("toggles visibility of additional grants", () => {
    render(<GrantsPanel grants={mockGrants} onClose={mockOnClose} />);
    fireEvent.click(screen.getByText("Show More Grants"));
    expect(screen.getByText(/Grant 2/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText("Hide More Grants"));
    expect(screen.queryByText(/Grant 2/i)).not.toBeInTheDocument();
  });
});

describe("CombinedPanel", () => {
  const mockOnClose = jest.fn();
  const mockWorks = [
    {
      name: "California",
      works: [
        {
          title: "Hypoparathyroidism After Total Thyroidectomy: A Population-Based Analysis of California Databases",
          issued: "2025-06",
          confidence: "91.8",
        },
      ],
    },
  ];
  const mockGrants = [
    {
      name: "California",
      grants: [
        {
          title: "Grant 1",
          funder: "Funder 1",
          startDate: "2020",
          endDate: "2021",
          confidence: "High",
        },
      ],
    },
  ];

  it("renders correctly with works and grants", () => {
    render(<CombinedPanel works={mockWorks} grants={mockGrants} onClose={mockOnClose} />);
    const locationContainer = screen.getByRole("heading", { level: 2 });
    expect(locationContainer).toBeInTheDocument();
    expect(within(locationContainer).getByText("Location:")).toBeInTheDocument();
    const californiaElement = screen.getByText("California");
    expect(californiaElement).toBeInTheDocument();
    expect(screen.getByText(/Works \(1\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Grants \(1\)/i)).toBeInTheDocument();
  });

  it("switches between tabs", () => {
    render(<CombinedPanel works={mockWorks} grants={mockGrants} onClose={mockOnClose} />);
    fireEvent.click(screen.getByText(/Grants \(1\)/i));
    expect(screen.getByText(/Grant 1/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Works \(1\)/i));
    expect(screen.getByText(/Hypoparathyroidism After Total Thyroidectomy/i)).toBeInTheDocument();
  });

  it("calls onClose when the close button is clicked", () => {
    render(<CombinedPanel works={mockWorks} grants={mockGrants} onClose={mockOnClose} />);
    fireEvent.click(screen.getByText("×"));
    expect(mockOnClose).toHaveBeenCalled();
  });
});