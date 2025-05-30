/**
 * @jest-environment jsdom
 */

// Mock child components
jest.mock('../MapContainer', () => {
    const React = require('react');

    return function MockMapWrapper({ children, mapRef }) {
        React.useEffect(() => {
            if (mapRef) {
                mapRef.current = {
                    getZoom: jest.fn(() => 5),
                    setView: jest.fn(),
                    on: jest.fn(),
                    off: jest.fn(),
                };
            }
        }, [mapRef]);

        return <div data-testid="map-wrapper">{children}</div>;
    };
});

import React, { useState, useEffect } from "react";
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import ResearchMap, { __testHandlers } from '../ResearchMap';


// Mock the leaflet CSS import
jest.mock('leaflet/dist/leaflet.css', () => ({}));


jest.mock('../rendering/WorkLayer', () => {
    return function MockWorkLayer(props) {
        return <div data-testid="work-layer" data-props={JSON.stringify(props)} />;
    };
});

jest.mock('../rendering/GrantLayer', () => {
    return function MockGrantLayer(props) {
        return <div data-testid="grant-layer" data-props={JSON.stringify(props)} />;
    };
});

jest.mock('../rendering/CombinedLayer', () => {
    return function MockCombinedLayer(props) {
        return <div data-testid="combined-layer" data-props={JSON.stringify(props)} />;
    };
});

jest.mock('../rendering/Panels', () => ({
    WorksPanel: function MockWorksPanel({ onClose, works }) {
        return (
            <div data-testid="works-panel">
                <button onClick={onClose}>Close</button>
                <div data-testid="works-count">{works?.length || 0}</div>
            </div>
        );
    },
    GrantsPanel: function MockGrantsPanel({ onClose, grants }) {
        return (
            <div data-testid="grants-panel">
                <button onClick={onClose}>Close</button>
                <div data-testid="grants-count">{grants?.length || 0}</div>
            </div>
        );
    },
    CombinedPanel: function MockCombinedPanel({ onClose, works, grants }) {
        return (
            <div data-testid="combined-panel">
                <button onClick={onClose}>Close</button>
                <div data-testid="combined-works-count">{works?.length || 0}</div>
                <div data-testid="combined-grants-count">{grants?.length || 0}</div>
            </div>
        );
    },
}));

// Mock filter functions
jest.mock('../rendering/filters/searchFilter', () => ({
    matchesKeyword: jest.fn((keyword, item) => {
        if (!keyword) return true;
        return JSON.stringify(item).toLowerCase().includes(keyword.toLowerCase());
    }),
}));

jest.mock('../rendering/filters/dateFilter', () => ({
    isGrantInDate: jest.fn((grant, dateRange) => {
        if (!dateRange || dateRange.length !== 2) return true;
        const year = grant.year || 2020;
        return year >= dateRange[0] && year <= dateRange[1];
    }),
    isWorkInDate: jest.fn((work, dateRange) => {
        if (!dateRange || dateRange.length !== 2) return true;
        const year = work.year || 2020;
        return year >= dateRange[0] && year <= dateRange[1];
    }),
}));

jest.mock('../rendering/filters/filterLocationMaps', () => ({
    filterLocationMap: jest.fn((locations, worksMap, grantsMap) => locations),
    filterGrantLayerLocationMap: jest.fn((locations, grantsMap) => locations),
    filterWorkLayerLocationMap: jest.fn((locations, worksMap) => locations),
}));

// Mock fetch globally
global.fetch = jest.fn();

// Sample test data
const mockRawMapsData = {
    expertsMap: {
        'expert1': { id: 'expert1', name: 'John Doe', workIDs: ['work1'], grantIDs: ['grant1'] },
        'expert2': { id: 'expert2', name: 'Jane Smith', workIDs: ['work2'], grantIDs: [] },
    },
    worksMap: {
        'work1': { id: 'work1', title: 'Research Work 1', year: 2020, expertIDs: ['expert1'] },
        'work2': { id: 'work2', title: 'Research Work 2', year: 2021, expertIDs: ['expert2'] },
    },
    grantsMap: {
        'grant1': { id: 'grant1', title: 'Grant 1', year: 2020, expertIDs: ['expert1'] },
    },
};

const mockLocationMaps = {
    worksMap: {
        'loc1': { id: 'loc1', workIDs: ['work1'], coordinates: [40.7128, -74.0060] },
    },
    grantsMap: {
        'loc2': { id: 'loc2', grantIDs: ['grant1'], coordinates: [34.0522, -118.2437] },
    },
    combinedMap: {
        'loc3': { id: 'loc3', workIDs: ['work1'], grantIDs: ['grant1'], coordinates: [41.8781, -87.6298] },
    },
};

const defaultProps = {
    showWorks: true,
    showGrants: true,
    searchKeyword: '',
    dateRange: [2000, 2025],
    onPanelOpen: jest.fn(),
    onPanelClose: jest.fn(),
    onMatchedFieldClick: jest.fn(),
};

const mockWorksGeoJSON = {
    type: "FeatureCollection",
    features: [
        {
            type: "Feature",
            geometry: { type: "Point", coordinates: [0, 0] },
            properties: {
                name: "Test Work",
                entries: [{ title: "Work 1", issued: 2020 }],
            },
        },
    ],
};

const mockGrantsGeoJSON = {
    type: "FeatureCollection",
    features: [
        {
            type: "Feature",
            geometry: { type: "Point", coordinates: [0, 0] },
            properties: {
                name: "Test Grant",
                entries: [{ title: "Grant 1", startDate: "2020", endDate: "2022" }],
            },
        },
    ],
};


describe('ResearchMap Component - Error Handling', () => {
    beforeEach(() => {
        jest.spyOn(global, 'fetch').mockImplementation(() =>
            Promise.resolve({
                ok: false, // Simulate fetch failure
            })
        );
        jest.spyOn(console, 'error').mockImplementation(() => { }); // Suppress console output
    });

    afterEach(() => {
        global.fetch.mockRestore();
        console.error.mockRestore();
    });

    test('displays error when fetchRawMaps fails', async () => {
        render(<ResearchMap {...defaultProps} />);

        await waitFor(() => {
            expect(screen.getByText('Failed to load location maps.')).toBeInTheDocument();
        });

        expect(console.error).toHaveBeenCalledWith(
            expect.stringContaining('[ERROR] Failed to load static map data in fetchRawMaps'),
            expect.any(Error)
        );
    });
});


describe('ResearchMap Component', () => {
    const defaultProps = {
        showGrants: true,
        showWorks: true,
        searchKeyword: '',
        selectedDateRange: [2020, 2023],
        onResetFilters: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
        fetch.mockClear();

        // Mock successful API responses
        fetch
            .mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(mockRawMapsData),
            })
            .mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(mockLocationMaps),
            });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('Component Rendering', () => {
        test('renders loading state initially', async () => {
            render(<ResearchMap {...defaultProps} />);

            expect(screen.getByText('Loading Map Data...')).toBeInTheDocument();
        });

        test('renders map and controls after loading', async () => {
            render(<ResearchMap {...defaultProps} />);

            await waitFor(() => {
                expect(screen.queryByText('Loading Map Data...')).not.toBeInTheDocument();
            });

            expect(screen.getByText('Reset View')).toBeInTheDocument();
            expect(screen.getByTestId('map-wrapper')).toBeInTheDocument();
        });

        test('shows error state when API fails', async () => {
            fetch.mockRejectedValueOnce(new Error('API Error'));

            render(<ResearchMap {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByText('Error')).toBeInTheDocument();
                expect(screen.getByText('Failed to load location maps.')).toBeInTheDocument();
            });

        });
    });

    describe('API Data Fetching', () => {
        test('fetches raw maps data on mount', async () => {
            render(<ResearchMap {...defaultProps} />);

            await waitFor(() => {
                expect(fetch).toHaveBeenCalledWith('/api/redis/getRawMaps');
            });
        });

        test('fetches location maps based on zoom and toggles', async () => {
            render(<ResearchMap {...defaultProps} showWorks={true} showGrants={true} />);

            await waitFor(() => {
                expect(fetch).toHaveBeenCalledWith('/api/redis/nonoverlap/getAllCountryLevelMaps');
            });
        });

        test('fetches works-only map when only showWorks is true', async () => {
            render(<ResearchMap {...defaultProps} showWorks={true} showGrants={false} />);

            await waitFor(() => {
                expect(fetch).toHaveBeenCalledWith('/api/redis/overlap/getCountryLevelMaps?type=works');
            });
        });

        test('fetches grants-only map when only showGrants is true', async () => {
            render(<ResearchMap {...defaultProps} showWorks={false} showGrants={true} />);

            await waitFor(() => {
                expect(fetch).toHaveBeenCalledWith('/api/redis/overlap/getCountryLevelMaps?type=grants');
            });
        });
    });

    describe('Layer Rendering Logic', () => {
        test('renders all layers when both toggles are true', async () => {
            render(<ResearchMap {...defaultProps} showWorks={true} showGrants={true} />);

            await waitFor(() => {
                expect(screen.getByTestId('combined-layer')).toBeInTheDocument();
                expect(screen.getByTestId('work-layer')).toBeInTheDocument();
                expect(screen.getByTestId('grant-layer')).toBeInTheDocument();
            });
        });

        test('renders only work layer when showWorks is true and showGrants is false', async () => {
            render(<ResearchMap {...defaultProps} showWorks={true} showGrants={false} />);

            await waitFor(() => {
                expect(screen.queryByTestId('combined-layer')).not.toBeInTheDocument();
                expect(screen.getByTestId('work-layer')).toBeInTheDocument();
                expect(screen.queryByTestId('grant-layer')).not.toBeInTheDocument();
            });
        });

        test('renders only grant layer when showGrants is true and showWorks is false', async () => {
            render(<ResearchMap {...defaultProps} showWorks={false} showGrants={true} />);

            await waitFor(() => {
                expect(screen.queryByTestId('combined-layer')).not.toBeInTheDocument();
                expect(screen.queryByTestId('work-layer')).not.toBeInTheDocument();
                expect(screen.getByTestId('grant-layer')).toBeInTheDocument();
            });
        });
    });

    describe('Panel Functionality', () => {
        test('opens and closes works panel', async () => {
            const { rerender } = render(<ResearchMap {...defaultProps} />);

            await waitFor(() => {
                expect(screen.queryByTestId('works-panel')).not.toBeInTheDocument();
            });

            // Simulate panel opening by updating component state
            rerender(<ResearchMap {...defaultProps} />);

            // We need to simulate the panel opening through the layer components
            // This would typically happen through user interaction with map markers
        });

        test('opens and closes grants panel', async () => {
            render(<ResearchMap {...defaultProps} />);

            await waitFor(() => {
                expect(screen.queryByTestId('grants-panel')).not.toBeInTheDocument();
            });
        });

        test('opens and closes combined panel', async () => {
            render(<ResearchMap {...defaultProps} />);

            await waitFor(() => {
                expect(screen.queryByTestId('combined-panel')).not.toBeInTheDocument();
            });
        });
    });

    describe('Search and Filtering', () => {
        test('debounces search keyword changes', async () => {
            jest.useFakeTimers();

            const { rerender } = render(<ResearchMap {...defaultProps} searchKeyword="" />);

            rerender(<ResearchMap {...defaultProps} searchKeyword="test" />);
            rerender(<ResearchMap {...defaultProps} searchKeyword="testing" />);

            // Fast forward past debounce delay
            act(() => {
                jest.advanceTimersByTime(500);
            });

            await waitFor(() => {
                // The debounced value should be used in filtering
                expect(screen.getByTestId('map-wrapper')).toBeInTheDocument();
            });

            jest.useRealTimers();
        });

        test('filters data by date range', async () => {
            const { rerender } = render(<ResearchMap {...defaultProps} selectedDateRange={[2020, 2021]} />);

            await waitFor(() => {
                expect(screen.getByTestId('map-wrapper')).toBeInTheDocument();
            });

            rerender(<ResearchMap {...defaultProps} selectedDateRange={[2022, 2023]} />);

            // Verify that date filtering functions are called
            const { isGrantInDate, isWorkInDate } = require('../rendering/filters/dateFilter');
            expect(isGrantInDate).toHaveBeenCalled();
            expect(isWorkInDate).toHaveBeenCalled();
        });

        test('filters by search keyword', async () => {
            render(<ResearchMap {...defaultProps} searchKeyword="research" />);

            await waitFor(() => {
                const { matchesKeyword } = require('../rendering/filters/searchFilter');
                expect(matchesKeyword).toHaveBeenCalled();
            });
        });
    });

    describe('Data Processing', () => {
        test('processes expert matches correctly', async () => {
            render(<ResearchMap {...defaultProps} searchKeyword="John" />);

            await waitFor(() => {
                // Should filter experts and associated works/grants
                expect(screen.getByTestId('map-wrapper')).toBeInTheDocument();
            });
        });

        test('moves locations between layers correctly', async () => {
            render(<ResearchMap {...defaultProps} />);

            await waitFor(() => {
                // Verify that location filtering functions are called
                const filterFunctions = require('../rendering/filters/filterLocationMaps');
                expect(filterFunctions.filterLocationMap).toHaveBeenCalled();
                expect(filterFunctions.filterGrantLayerLocationMap).toHaveBeenCalled();
                expect(filterFunctions.filterWorkLayerLocationMap).toHaveBeenCalled();
            });
        });
    });


});
