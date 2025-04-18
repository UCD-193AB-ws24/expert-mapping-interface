// useEffect(() => {
  //   setIsLoading(true);
  
  //   // Fetch data from two different APIs concurrently
  //   Promise.all([
  //     fetch("http://localhost:3001/api/redis/worksQuery").then((response) => {
  //       if (!response.ok) {
  //         throw new Error(`HTTP error! Status: ${response.status}`);
  //       }
  //       return response.json();
  //     }),
  //     fetch("http://localhost:3001/api/redis/grantsQuery").then((response) => {
  //       if (!response.ok) {
  //         throw new Error(`HTTP error! Status: ${response.status}`);
  //       }
  //       return response.json();
  //     }),
  //   ])
  //     .then(([worksData, grantsData]) => {
  //       setGeoData(worksData); // Set works data
  //       setGrantGeoJSON(grantsData); // Set grants data
  //       setIsLoading(false);
  //     })
  //     .catch((error) => {
  //       console.error("Error fetching data:", error);
  //       setIsLoading(false);
  //       setError("Failed to load map data. Please ensure the API server is running on port 3001.");
  //     });
  // }, []);