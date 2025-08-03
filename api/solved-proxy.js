const fetch = require('node-fetch');

module.exports = async (req, res) => {
    const { handle, page } = req.query; // Vercel Functions는 쿼리 파라미터를 req.query로 받습니다.

    let solvedAcUrl = '';
    // req.url을 사용하여 어떤 API 요청인지 구분합니다.
    if (req.url.includes('/api/problem_stats')) {
        solvedAcUrl = `https://solved.ac/api/v3/user/problem_stats?handle=${handle}`;
    } else if (req.url.includes('/api/rating_warning_problems')) {
        solvedAcUrl = `https://solved.ac/api/v3/search/problem?query=%40${handle}+*b5..+w%3F&direction=desc&sort=level&page=${page}`;
    } else if (req.url.includes('/api/unsolved_rating_warning_problems')) {
        solvedAcUrl = `https://solved.ac/api/v3/search/problem?query=*-@${handle}+*b5..+w%3F&direction=asc&sort=level&page=${page}`;
    } else {
        res.status(404).json({ message: "Not Found" });
        return;
    }

    try {
        const response = await fetch(solvedAcUrl, {
            method: 'GET',
            headers: { Accept: 'application/json' }
        });
        const data = await response.json();

        res.status(response.status).json(data);
    } catch (error) {
        console.error("Proxy error:", error);
        res.status(500).json({ message: "Error fetching data from solved.ac via proxy", error: error.message });
    }
};