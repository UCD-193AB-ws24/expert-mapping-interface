1. /aggieExpertsAPI
    - fetchAll
        - runs:
            - a. fetchExperts
            - b. fetchGrants
            - c. fetchWorks
    - matchAll
        - matches grants and works to experts: {name, url, etc..}
        - matches works by name and grants by url
    - apiUtils
        - commonly used helper functions

2. /locationAssignment
    - processLocations
        - runs:
            - a. extractLocations
                - extracts location from entry info
            - b. validateLocations
                - checks output against iso
            - c. geocodeLocations
                - fetches geojson feature associated with validated locations

3. /geojsonGeneration
    - combines location coordinates with location based works and grants
    - generates 2 geojsons:
        - grants.geojson
        - works.geojson
