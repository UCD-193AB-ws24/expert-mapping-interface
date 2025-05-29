/**
 * @file App.test.js
 * @description Tests for the main App component, including:
 *   - Rendering and UI logic
 *   - User interaction and event handling
 *   - Mocking of assets and browser APIs
 *
 * Uses jsdom environment for React component testing.
 */

/**
 * @jest-environment jsdom
 */

jest.mock("../assets/aggie-experts-logo-primary.png", () => "mock-image.png");

import React from "react";
import { render, screen, fireEvent, act, within } from "@testing-library/react";
import App from "../App";
import '@testing-library/jest-dom';

// Mock ResizeObserver
beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };

  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
});

jest.mock("../components/ResearchMap", () => (props) => {
  // This ensures all the props from App.js get accessed, so App's logic gets covered
  return (
    <div data-testid="mocked-researchmap">
      <div>showGrants: {String(props.showGrants)}</div>
      <div>showWorks: {String(props.showWorks)}</div>
      <div>searchKeyword: {props.searchKeyword}</div>
      <div>selectedDateRange: {props.selectedDateRange.join(" - ")}</div>
      <button onClick={props.onResetFilters}>Reset (mock)</button>
    </div>
  );
});


describe("App component", () => {
  test("renders the Aggie Experts logo image", () => {
    render(<App />);
    const logo = screen.getByAltText("Aggie Experts Logo");
    expect(logo).toBeInTheDocument();
  });

  test("updates search keyword after debounce delay", () => {
    jest.useFakeTimers();
    render(<App />);
    const input = screen.getByPlaceholderText("Search keyword");
  
    fireEvent.change(input, { target: { value: "water" } });
  
    act(() => {
      jest.advanceTimersByTime(200); // ensures useEffect's setState is flushed
    });
  
    expect(screen.getByTestId("mocked-researchmap")).toHaveTextContent("water");
  
    jest.useRealTimers();
  });

  
  test("toggles Show Grants and Show Works checkboxes", () => {
    render(<App />);
    const grantCheckbox = screen.getByLabelText("Show Grants");
    const workCheckbox = screen.getByLabelText("Show Works");
    expect(grantCheckbox).toBeChecked();
    expect(workCheckbox).toBeChecked();
  
    grantCheckbox.click();
    workCheckbox.click();
    expect(grantCheckbox).not.toBeChecked();
    expect(workCheckbox).not.toBeChecked();
  });
  
  test("enables Reset Filters button when filters change", () => {
    render(<App />);
    const grantCheckbox = screen.getByLabelText("Show Grants");
    const resetButton = screen.getByText("Reset Filters");
    expect(resetButton).toBeDisabled();
  
    grantCheckbox.click();
    expect(resetButton).toBeEnabled();
  
    resetButton.click();
    expect(grantCheckbox).toBeChecked();
    expect(resetButton).toBeDisabled();
  });
  
  test("toggles Show Grants and Show Works", () => {
    render(<App />);
    const grantToggle = screen.getByLabelText("Show Grants");
    const workToggle = screen.getByLabelText("Show Works");
  
    // Initially checked
    expect(grantToggle).toBeChecked();
    expect(workToggle).toBeChecked();
  
    // Click to toggle off
    grantToggle.click();
    workToggle.click();
    expect(grantToggle).not.toBeChecked();
    expect(workToggle).not.toBeChecked();
  
    // Toggle back on
    grantToggle.click();
    workToggle.click();
    expect(grantToggle).toBeChecked();
    expect(workToggle).toBeChecked();
  });
  
  //mobile test
  test("interacts with Filter modal toggles and Reset button", () => {
    render(<App />);
    const filterBtn = screen.getByLabelText("Show filters");
    fireEvent.click(filterBtn); // open the modal
  
    // Find elements by the second instance (modal)
    const grantToggles = screen.getAllByLabelText("Show Grants");
    const workToggles = screen.getAllByLabelText("Show Works");
    const grantToggle = grantToggles[1]; // 0 is sidebar, 1 is modal
    const workToggle = workToggles[1];
  
    fireEvent.click(grantToggle);
    fireEvent.click(workToggle);
    expect(grantToggle).not.toBeChecked();
    expect(workToggle).not.toBeChecked();
  
    const resetButtons = screen.getAllByText("Reset Filters");
    const resetButton = resetButtons[1];
    fireEvent.click(resetButton);
    expect(grantToggle).toBeChecked();
    expect(workToggle).toBeChecked();
  
    // Close modal
    const closeBtn = screen.getByLabelText("Close filters");
    fireEvent.click(closeBtn);
  
    // Confirm it's gone by checking absence of modal-specific Reset Filters
    expect(screen.queryAllByText("Reset Filters").length).toBe(1); // only the sidebar remains
  });
  
  test("opens guide modal", () => {
    render(<App />);
    const guideBtn = screen.getByLabelText("Show map guide");
    fireEvent.click(guideBtn);
  
    const headings = screen.getAllByText("Map Guide");
    expect(headings.length).toBeGreaterThan(1); // confirms modal version is added
  });
  
  test("closes guide modal", () => {
    render(<App />);
    fireEvent.click(screen.getByLabelText("Show map guide"));
  
    const modal = screen.getByTestId("guide-modal");
    expect(modal).toBeInTheDocument();
  
    const closeBtn = within(modal).getByLabelText("Close guide");
    fireEvent.click(closeBtn);
  
    expect(screen.queryByTestId("guide-modal")).not.toBeInTheDocument();
  });
  
  

});
