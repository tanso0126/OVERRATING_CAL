const fetch = require('node-fetch');

exports.handler = async function(event, context) {
    const { path, queryStringParameters } = event;
    const handle = queryStringParameters.handle;
    const page = queryStringParameters.page || 1;

    let solvedAcUrl = '';
    if (path.includes('/api/problem_stats')) {
        solvedAcUrl = `https://solved.ac/api/v3/user/problem_stats?handle=${handle}`;
    } else if (path.includes('/api/rating_warning_problems')) {
        solvedAcUrl = `https://solved.ac/api/v3/search/problem?query=%40${handle}+*b5..+w%3F&direction=desc&sort=level&page=${page}`;
    } else if (path.includes('/api/unsolved_rating_warning_problems')) {
        solvedAcUrl = `https://solved.ac/api/v3/search/problem?query=*-@${handle}+*b5..+w%3F&direction=asc&sort=level&page=${page}`;
    } else {
        return {
            statusCode: 404,
            body: JSON.stringify({ message: "Not Found" })
        };
    }

    try {
        const response = await fetch(solvedAcUrl, {
            method: 'GET',
            headers: { Accept: 'application/json' }
        });
        const data = await response.json();

        return {
            statusCode: response.status,
            headers: {
                "Access-Control-Allow-Origin": "*", // CORS 허용
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
        };
    } catch (error) {
        console.error("Proxy error:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: "Error fetching data from solved.ac via proxy", error: error.message })
        };
    }
};