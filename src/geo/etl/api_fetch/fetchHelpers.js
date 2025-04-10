const axios = require('axios');
const { AUTH_TOKEN } = require('./auth');

async function fetchData(params) {
    try {
        if (!AUTH_TOKEN) {
            throw new Error('AUTH_TOKEN is missing. Please check your auth.js file.');
        }

        const response = await axios.get(`https://experts.ucdavis.edu/api/search`, {
            params,
            headers: {
                'Authorization': AUTH_TOKEN
            }
        });

        return response.data.hits || [];
    } catch (error) {
        if (error.response && error.response.status === 401) {
            console.error('Error fetching data: Unauthorized (401). Please check your AUTH_TOKEN.');
        } else {
            console.error('Error fetching data:', error.message);
        }
        throw error;
    }
}

module.exports = { fetchData };
