/**
 * @jest-environment jsdom
 */

import React from "react";
import "@testing-library/jest-dom";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { getConfidenceStyle, WorksPanel, GrantsPanel, CombinedPanel } from "../rendering/Panels";

describe("getConfidenceStyle", () => {   //confidence style tests
  it("returns fallback for undefined", () => {
    expect(getConfidenceStyle(undefined)).toEqual({ label: '', style: {} });
  });

  it("returns styled green for high", () => {
    expect(getConfidenceStyle("high").label).toBe("High");
  });

  it("returns styled red for low", () => {
    expect(getConfidenceStyle("low").label).toBe("Low");
  });

  it("returns fallback style for unexpected value", () => {
    const result = getConfidenceStyle("Medium");
    expect(result.label).toBe("Medium");
    expect(result.style.color).toBe("#757575");
  });
});

describe("WorksPanel", () => {  //works panel tests
  const mockOnClose = jest.fn();
  const mockWorks = [ //mock works data
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

  it("renders fallback 'No Profile Found' when expert url is missing", () => {
    const mockWorks = [
      {
        name: "Test Expert",
        works: [
          { title: "Title", issued: "2025", confidence: "High" }
        ],
        url: undefined // explicitly no URL
      }
    ];
    render(<WorksPanel works={mockWorks} onClose={() => { }} />);
    expect(screen.getByText("No Profile Found")).toBeInTheDocument();
  });

  it("displays matched fields in additional works in WorksPanel", () => {
    const mockWorks = [
      {
        name: "Expert A",
        works: [
          {
            title: "First Work",
            issued: "2024",
            confidence: "High",
            matchedFields: [{ field: "abstract", match: "data science" }],
          },
          {
            title: "Second Work",
            issued: "2023",
            confidence: "Low",
          },
        ],
        url: "http://example.com",
      },
    ];
    render(<WorksPanel works={mockWorks} onClose={() => { }} />);
    fireEvent.click(screen.getByText("Show More Works"));
    // Ensure matched fields are displayed
    const matchedOnLabels = screen.getAllByText(/Matched on:/i);
    expect(matchedOnLabels.length).toBeGreaterThan(0);
    expect(screen.getAllByText(/data science/i).length).toBeGreaterThan(0);
  });

  it("displays matched fields if present", () => {
    const mockWorks = [
      {
        name: "Matched Expert",
        works: [
          {
            title: "Matched Work",
            issued: "2025",
            confidence: "High",
            matchedFields: [{ field: "abstract", match: "biology" }]
          }
        ],
        url: "http://example.com"
      }
    ];
    // Render the component with mock data
    render(<WorksPanel works={mockWorks} onClose={() => { }} />);
    expect(screen.getByText(/Matched on:/i)).toBeInTheDocument();// Check if the matched field is displayed
    expect(screen.getByText(/biology/)).toBeInTheDocument();  // Check if the match text is displayed
  });

  it("renders expert with no works without crashing", () => {
    const mockWorks = [
      {
        name: "No Works Expert",
        works: [],
        url: "http://example.com"
      }
    ];
    render(<WorksPanel works={mockWorks} onClose={() => { }} />); // Render the component with mock data
    expect(screen.getByText("No Works Expert")).toBeInTheDocument();  // Check if the expert name is displayed
    expect(screen.queryByText(/Title:/)).not.toBeInTheDocument(); // Ensure no works are displayed
  });

  it("toggles visibility of additional works", () => {
    render(<WorksPanel works={mockWorks} onClose={mockOnClose} />);
    fireEvent.click(screen.getByText("Show More Works")); // Click to show more works
    expect(screen.getByText(/Community-acquired Staphylococcus aureus/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText("Hide More Works")); // Click to hide additional works
    expect(screen.queryByText(/Community-acquired Staphylococcus aureus/i)).not.toBeInTheDocument();
  });
});

describe("GrantsPanel", () => { //grants panel tests
  const mockOnClose = jest.fn();
  const mockGrants = [  //mock grants data
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

  it("does not render matched fields when matchedFields is an empty array in additional grants", () => {
    const mockGrants = [
      {
        name: "Edge Case Expert",
        grants: [
          {
            title: "Primary Grant",
            funder: "Funder X",
            confidence: "High",
          },
          {
            title: "Extra Grant",
            funder: "Funder Y",
            confidence: "Low",
            matchedFields: [] //empty array
          },
        ],
      },
    ];

    render(<GrantsPanel grants={mockGrants} onClose={() => { }} />);
    fireEvent.click(screen.getByText("Show More Grants"));

    // Confirm the extra grant renders
    expect(screen.getByText(/Extra Grant/)).toBeInTheDocument();

    // Confirm no matched fields are shown
    expect(screen.queryByText(/Matched on:/i)).not.toBeInTheDocument();
  });

  it("toggles grant dropdown visibility", () => {
    const mockWorks = [{ name: "Grant Expert", works: [], location: "Testland" }];
    render(<CombinedPanel works={mockWorks} grants={mockGrants} onClose={() => { }} />);

    fireEvent.click(screen.getByText("Grants (2)"));  // Switch to grants tab

    const toggleBtn = screen.getByText("Show More Grants"); // Find the toggle button
    fireEvent.click(toggleBtn);
    expect(screen.getByText("Hide More Grants")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Hide More Grants"));  // Hide the additional grants
    expect(screen.getByText("Show More Grants")).toBeInTheDocument();
  });

  it("displays matched fields in additional grants in GrantsPanel", () => {
    const mockGrants = [
      {
        name: "Expert B",
        grants: [
          { title: "Primary Grant", funder: "Funder A" },
          {
            title: "Secondary Grant",
            funder: "Funder B",
            startDate: "2022",
            endDate: "2023",
            confidence: "High",
            matchedFields: [{ field: "funder", match: "Funder B" }],
          },
        ],
        url: "http://example.com",
      },
    ];

    render(<GrantsPanel grants={mockGrants} onClose={() => { }} />);
    fireEvent.click(screen.getByText("Show More Grants"));

    const matchedFields = screen.getAllByText(/Matched on:/i);  // Check if matched fields are displayed
    expect(matchedFields.length).toBeGreaterThan(0);

    const funderMatches = screen.getAllByText(/Funder B/i);
    expect(funderMatches.length).toBeGreaterThan(0);  // Ensure the match text is displayed
  });

  it("gracefully handles grant with no matchedFields property", () => {
    const mockGrants = [
      {
        name: "No Match Grant Expert",
        grants: [
          { title: "Plain Grant", funder: "DOE", startDate: "2023", endDate: "2024", confidence: "High" }
        ],
      },
    ];
    render(<GrantsPanel grants={mockGrants} onClose={() => { }} />);  // Render the component with mock data
    expect(screen.queryByText(/Matched on:/i)).not.toBeInTheDocument(); // Ensure no matched fields are displayed
  });

  it("renders with empty grants array by faking one empty object", () => {
    const mockGrants = [
      {
        name: "Fallback Grant Expert",
        grants: [{}],  // at least one item, but no properties
      },
    ];
    render(<GrantsPanel grants={mockGrants} onClose={() => { }} />);
    expect(screen.getByText("Fallback Grant Expert")).toBeInTheDocument();
    expect(screen.getByText((content) => content.includes("Untitled Grant"))).toBeInTheDocument();
  });

  it("displays matched fields if present in grants", () => {
    const mockGrants = [
      {
        name: "Matched Grant Expert",
        grants: [
          {
            title: "Grant with Match",
            funder: "Funder A",
            startDate: "2023",
            endDate: "2024",
            confidence: "Low",
            matchedFields: [{ field: "title", match: "climate" }]
          }
        ],
        url: "http://example.com"
      }
    ];

    render(<GrantsPanel grants={mockGrants} onClose={() => { }} />);
    expect(screen.getByText(/Matched on:/i)).toBeInTheDocument();
    expect(screen.getByText(/climate/i)).toBeInTheDocument(); // Check if the match text is displayed
  });

  it("toggles visibility of additional grants", () => {
    render(<GrantsPanel grants={mockGrants} onClose={mockOnClose} />);
    fireEvent.click(screen.getByText("Show More Grants"));
    expect(screen.getByText(/Grant 2/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText("Hide More Grants"));
    expect(screen.queryByText(/Grant 2/i)).not.toBeInTheDocument();
  });
});

describe("CombinedPanel", () => { //combined panel tests
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

  it("renders matchedFields block in additional grants in CombinedPanel", () => {
    const mockWorks = [
      {
        name: "Expert A",
        location: "California",
        works: [
          { title: "Work A", issued: "2023", confidence: "High" },
          { title: "Work B", issued: "2022", confidence: "Low" },
        ],
      },
    ];

    const mockGrants = [
      {
        name: "Expert A",
        grants: [
          { title: "Grant A", funder: "Funder A", confidence: "High" },
          {
            title: "Grant B",
            funder: "Funder B",
            confidence: "Low",
            matchedFields: [
              { field: "funder", match: "Funder B" },
              { field: "abstract", match: "clean energy" },
            ],
          },
        ],
      },
    ];

    render(<CombinedPanel works={mockWorks} grants={mockGrants} onClose={() => { }} />);

    // Switch to grants tab and expand
    fireEvent.click(screen.getByText(/Grants/i));
    fireEvent.click(screen.getByText(/Show More Grants/i));

    // This ensures the <div key={i}> block is rendered
    expect(screen.getByText((_, node) =>
      node.textContent === 'Matched on: funder — "Funder B"'
    )).toBeInTheDocument();

    expect(screen.getByText((_, node) =>
      node.textContent === 'Matched on: abstract — "clean energy"'
    )).toBeInTheDocument();

  });

  it("displays matched fields in extra entries in CombinedPanel", () => {
    const mockWorks = [
      {
        name: "Expert C",
        location: "California",
        works: [
          {
            title: "Work A",
            issued: "2022",
            confidence: "High",
            matchedFields: [{ field: "abstract", match: "ecology" }]
          },
          {
            title: "Work B",
            issued: "2021",
            confidence: "Low"
          },
        ],
      },
    ];

    const mockGrants = [
      {
        name: "Expert C",
        grants: [
          {
            title: "Grant A",
            funder: "NSF",
            matchedFields: [{ field: "title", match: "Grant B" }]
          },
          {
            title: "Grant B",
            funder: "DOE",
            startDate: "2023",
            endDate: "2024",
            confidence: "High"
          },
        ],
      },
    ];

    render(<CombinedPanel works={mockWorks} grants={mockGrants} onClose={() => { }} />);

    // Expand extra works
    fireEvent.click(screen.getByText(/Show More Works/i));
    expect(screen.getAllByText(/Matched on:/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/ecology/i).length).toBeGreaterThan(0);

    // Switch to grants and expand extra grants
    fireEvent.click(screen.getByText(/Grants \(2\)/i));
    fireEvent.click(screen.getByText(/Show More Grants/i));
    expect(screen.getAllByText(/Matched on:/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Grant B/i).length).toBeGreaterThan(0);
  });

  it("switches between tabs", () => {
    render(<CombinedPanel works={mockWorks} grants={mockGrants} onClose={mockOnClose} />);
    fireEvent.click(screen.getByText(/Grants \(1\)/i)); // Switch to grants tab
    expect(screen.getByText(/Grant 1/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Works \(1\)/i));  // Switch back to works tab
    expect(screen.getByText(/Hypoparathyroidism After Total Thyroidectomy/i)).toBeInTheDocument();
  });

  it("renders fallback 'No Profile Found' when expert URL is missing", () => {
    const mockWorks = [{ name: "Expert A", location: "California", works: [{ title: "Work A", issued: "2024", confidence: "High" }], url: undefined }];
    const mockGrants = [{ name: "Expert A", grants: [{ title: "Grant A", confidence: "High" }], url: undefined }];

    render(<CombinedPanel works={mockWorks} grants={mockGrants} onClose={() => { }} />);
    expect(screen.getByText("No Profile Found")).toBeInTheDocument(); // Check if the fallback message is displayed

    fireEvent.click(screen.getByText(/Grants/i));
    expect(screen.getByText("No Profile Found")).toBeInTheDocument(); // Ensure it appears in grants tab as well
  });

  it("renders expert with no works or grants without crashing", () => {
    const mockWorks = [
      {
        name: "No Works Expert",
        works: [],
        url: null,
        location: "California"
      }
    ];

    const mockGrants = [
      {
        name: "No Grants Expert",
        grants: [{}],
        url: null
      }
    ];

    render(<CombinedPanel works={mockWorks} grants={mockGrants} onClose={() => { }} />);
    fireEvent.click(screen.getByText(/Grants/i));
    expect(screen.getByText("No Grants Expert")).toBeInTheDocument(); // Check if the expert name is displayed
    expect(screen.getByText(/Untitled Grant/i)).toBeInTheDocument(); // fallback title
  });

  it("renders 'View Profile' if expert URL is defined", () => {
    const mockWorks = [{
      name: "Expert With URL",
      location: "California",
      url: "http://example.com",
      works: [
        { title: "Test Work", issued: "2025", confidence: "High" }
      ]
    }];

    render(<CombinedPanel works={mockWorks} grants={[]} onClose={() => { }} />);
    expect(screen.getByText("View Profile")).toBeInTheDocument(); // Check if the 'View Profile' link is rendered
  });

  it("renders 'No Profile Found' if expert URL is missing", () => {
    const mockWorks = [{
      name: "Expert No URL",
      location: "California",
      url: undefined,
      works: [
        { title: "Test Work", issued: "2025", confidence: "High" }
      ]
    }];

    render(<CombinedPanel works={mockWorks} grants={[]} onClose={() => { }} />);
    expect(screen.getByText("No Profile Found")).toBeInTheDocument(); // Check if the 'No Profile Found' message is rendered
  });

  it("renders matchedFields without match in additional grants (CombinedPanel)", () => {
    const mockGrants = [
      {
        name: "Expert X",
        grants: [
          {
            title: "Main Grant",
            funder: "NSF",
          },
          {
            title: "Extra Grant",
            funder: "DOE",
            matchedFields: [
              { field: "funder" },
            ],
          },
        ],
      },
    ];
    const mockWorks = [
      {
        name: "Expert X",
        works: [],
        location: "Nowhere",
      },
    ];

    render(<CombinedPanel works={mockWorks} grants={mockGrants} onClose={() => { }} />);
    fireEvent.click(screen.getByText("Grants (2)"));  // Switch to grants tab
    fireEvent.click(screen.getByText("Show More Grants"));  // Expand additional grants

    const matches = screen.getAllByText((_, el) =>
      el?.textContent?.trim() === "Matched on: funder"
    );
    expect(matches.length).toBeGreaterThan(0);  // Ensure matched field is displayed

    expect(screen.queryByText(/—/)).not.toBeInTheDocument(); // no dash should appear
  });

});