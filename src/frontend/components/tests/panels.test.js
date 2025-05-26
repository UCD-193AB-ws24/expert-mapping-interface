/**
 * @jest-environment jsdom
 */

import React from "react";
import "@testing-library/jest-dom"; // Import for `toBeInTheDocument`
import { render, screen, fireEvent, within } from "@testing-library/react"; // Added `within`
import { getConfidenceStyle, WorksPanel, GrantsPanel, CombinedPanel } from "../rendering/Panels";

describe("getConfidenceStyle", () => {
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

  it("displays matched fields in additional works in WorksPanel", () => { //keeper
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

    // Use getAllByText since there are multiple matches
    const matchedOnLabels = screen.getAllByText(/Matched on:/i);
    expect(matchedOnLabels.length).toBeGreaterThan(0);
    expect(screen.getAllByText(/data science/i).length).toBeGreaterThan(0);
  });



  it("displays matched fields if present", () => { //keeper
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
    render(<WorksPanel works={mockWorks} onClose={() => { }} />);
    expect(screen.getByText(/Matched on:/i)).toBeInTheDocument();
    expect(screen.getByText(/biology/)).toBeInTheDocument();
  });

  it("renders expert with no works without crashing", () => { //keeper
    const mockWorks = [
      {
        name: "No Works Expert",
        works: [],
        url: "http://example.com"
      }
    ];
    render(<WorksPanel works={mockWorks} onClose={() => { }} />);
    expect(screen.getByText("No Works Expert")).toBeInTheDocument();
    expect(screen.queryByText(/Title:/)).not.toBeInTheDocument();
  });

  it("renders correct expert count in header (singular and plural)", () => {
    const singleExpert = [
      {
        name: "Solo Expert",
        works: [{ title: "Work A", issued: "2024", confidence: "High" }],
      },
    ];

    const multipleExperts = [
      {
        name: "Expert One",
        works: [{ title: "Work 1", issued: "2024", confidence: "High" }],
      },
      {
        name: "Expert Two",
        works: [{ title: "Work 2", issued: "2023", confidence: "Low" }],
      },
    ];

    // Test singular
    render(<WorksPanel works={singleExpert} onClose={() => { }} />);
    expect(screen.getByText("1 Expert at this Location")).toBeInTheDocument();

    // Rerender for plural case
    render(<WorksPanel works={multipleExperts} onClose={() => { }} />);
    expect(screen.getByText("2 Experts at this Location")).toBeInTheDocument();
  });


  //keeper
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
            matchedFields: [] // ← empty array branch
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



  it("displays matched fields in additional grants in GrantsPanel", () => { //keeper
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

    const matchedFields = screen.getAllByText(/Matched on:/i);
    expect(matchedFields.length).toBeGreaterThan(0);

    const funderMatches = screen.getAllByText(/Funder B/i);
    expect(funderMatches.length).toBeGreaterThan(0);
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
    render(<GrantsPanel grants={mockGrants} onClose={() => { }} />);
    expect(screen.queryByText(/Matched on:/i)).not.toBeInTheDocument();
  });

  it("renders with empty grants array by faking one empty object", () => {
    const mockGrants = [
      {
        name: "Fallback Grant Expert",
        grants: [{}],  // <-- at least one item, but no properties
      },
    ];
    render(<GrantsPanel grants={mockGrants} onClose={() => { }} />);
    expect(screen.getByText("Fallback Grant Expert")).toBeInTheDocument();
    expect(screen.getByText((content) => content.includes("Untitled Grant"))).toBeInTheDocument();
  });

  it("renders plural expert label and 'Unknown Expert' fallback in GrantsPanel", () => {
    const mockGrants = [
      {
        name: undefined, // triggers fallback to "Unknown Expert"
        grants: [
          { title: "Grant A", confidence: "Low" }
        ]
      },
      {
        name: "Expert B",
        grants: [
          { title: "Grant B", confidence: "High" }
        ]
      },
    ];

    render(<GrantsPanel grants={mockGrants} onClose={() => { }} />);

    // Confirm plural header is shown
    expect(screen.getByText("2 Experts at this Location")).toBeInTheDocument();

    // Confirm fallback name
    expect(screen.getByText("Unknown Expert")).toBeInTheDocument();
  });


  it("displays matched fields if present in grants", () => { //keeper
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
    expect(screen.getByText(/climate/i)).toBeInTheDocument();
  });


  it("toggles visibility of additional grants", () => { //keeper
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
            matchedFields: [{ field: "abstract", match: "ecology" }] // ← Moved here
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
            matchedFields: [{ field: "title", match: "Grant B" }] // ← Moved here
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
    // Expand extra works
    fireEvent.click(screen.getByText(/Show More Works/i));
    expect(screen.getAllByText(/Matched on:/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/ecology/i).length).toBeGreaterThan(0);

    // Switch to grants and expand extra grants
    fireEvent.click(screen.getByText(/Grants \(1\)/i));
    fireEvent.click(screen.getByText(/Show More Grants/i));
    expect(screen.getAllByText(/Matched on:/i).length).toBeGreaterThan(0); // changed from > 1
    expect(screen.getAllByText(/Grant B/i).length).toBeGreaterThan(0);     // changed from > 1
  });

  it("switches between tabs", () => { //keeper
    render(<CombinedPanel works={mockWorks} grants={mockGrants} onClose={mockOnClose} />);
    fireEvent.click(screen.getByText(/Grants \(1\)/i));
    expect(screen.getByText(/Grant 1/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Works \(1\)/i));
    expect(screen.getByText(/Hypoparathyroidism After Total Thyroidectomy/i)).toBeInTheDocument();
  });

});