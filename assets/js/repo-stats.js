const GITHUB_TOKEN = localStorage.getItem('github_token');
const CACHE_KEY = 'repo_stats_cache';
const CACHE_DURATION = 3600000;

async function fetchRepoStats(owner, repo) {
    const cacheKey = `${owner}/${repo}`;
    const cached = getFromCache(cacheKey);

    if (cached) {
        return cached;
    }

    try {
        const headers = {
            'Accept': 'application/vnd.github.v3+json'
        };

        if (GITHUB_TOKEN) {
            headers['Authorization'] = `Bearer ${GITHUB_TOKEN}`;
        }

        const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {headers});
        if (!repoRes.ok) throw new Error(`Failed to fetch repo: ${repoRes.status}`);

        const repoData = await repoRes.json();
        const stars = repoData.stargazers_count;

        const commitsRes = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/commits?per_page=1`,
            {headers}
        );

        if (!commitsRes.ok) throw new Error(`Failed to fetch commits: ${commitsRes.status}`);

        const linkHeader = commitsRes.headers.get('link');
        const commits = linkHeader
            ? parseInt(linkHeader.match(/&page=(\d+)>; rel="last"/)?.[1] || '1')
            : 1;

        const stats = {stars, commits};
        saveToCache(cacheKey, stats);
        return stats;
    } catch (error) {
        console.warn(`Could not fetch stats for ${owner}/${repo}:`, error.message);
        return {stars: '—', commits: '—'};
    }
}

function getFromCache(key) {
    try {
        const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
        const cached = cache[key];

        if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
            return cached.data;
        }
    } catch (e) {
        console.error('Cache read error:', e);
    }
    return null;
}


function saveToCache(key, data) {
    try {
        const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
        cache[key] = {
            data,
            timestamp: Date.now()
        };
        localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch (e) {
        console.error('Cache write error:', e);
    }
}