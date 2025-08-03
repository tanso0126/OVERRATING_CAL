
const handleInput = document.getElementById('handleInput');
const calculateBtn = document.getElementById('calculateBtn');
const resultDiv = document.getElementById('result');
const difficultySelector = document.getElementById('difficulty-selector');
const difficultySlider = document.getElementById('difficultySlider');
const difficultyTierImage = document.getElementById('difficultyTierImage');
const movingTierIndicator = document.getElementById('movingTierIndicator');

const API_URL_STATS = '/api/problem_stats?handle=';
const API_URL_SOLVED_WARNING = '/api/rating_warning_problems?handle=';
const API_URL_UNSOLVED_WARNING = '/api/unsolved_rating_warning_problems?handle=';
const API_OPTIONS = { method: 'GET', headers: { Accept: 'application/json' } };
const TARGET_RATINGS = [12000, 13000, 14000, 15000, 16000];
const TOP_K = 1000;

const calculateOverRating = (level) => 11.8 + level * 0.2;

let preCalculatedResults = {};

calculateBtn.addEventListener('click', async () => {
    const handle = handleInput.value;
    if (!handle) {
        alert('핸들을 입력해주세요.');
        return;
    }

    resultDiv.innerHTML = '계산 중...';
    difficultySelector.style.display = 'none';
    preCalculatedResults = {};

    try {
        const statsResponse = await fetch(API_URL_STATS + handle, API_OPTIONS);
        if (!statsResponse.ok) throw new Error(`API 요청 실패: ${statsResponse.status}`);
        const stats = await statsResponse.json();

        // 각 난이도별 총 문제 수 (아직 풀지 않은 문제 수)
        const availableProblemsByLevel = new Map();
        stats.forEach(stat => {
            availableProblemsByLevel.set(stat.level, stat.total - stat.solved);
        });

        // 아직 풀지 않은 레이팅 경고 문제 가져오기
        let unsolvedWarningProblems = [];
        let currentPage = 1;
        while (true) {
            const warningResponse = await fetch(`${API_URL_UNSOLVED_WARNING}${handle}&page=${currentPage}`, API_OPTIONS);
            if (!warningResponse.ok) throw new Error(`Unsolved Warning API 요청 실패: ${warningResponse.status}`);
            const warningData = await warningResponse.json();
            unsolvedWarningProblems.push(...warningData.items);
            if (warningData.items.length < 50) break;
            currentPage++;
        }

        // 각 난이도별로 OverRating에 기여할 수 있는 실제 남은 문제 수 계산
        const effectiveAvailableProblemsByLevel = new Map(availableProblemsByLevel);
        unsolvedWarningProblems.forEach(p => {
            const currentCount = effectiveAvailableProblemsByLevel.get(p.level) || 0;
            if (currentCount > 0) {
                effectiveAvailableProblemsByLevel.set(p.level, currentCount - 1);
            }
        });

        const allSolvedProblems = [];
        stats.forEach(stat => {
            for (let i = 0; i < stat.solved; i++) {
                allSolvedProblems.push(stat.level);
            }
        });
        allSolvedProblems.sort((a, b) => b - a);

        let solvedWarningProblems = [];
        currentPage = 1;
        while (true) {
            const warningResponse = await fetch(`${API_URL_SOLVED_WARNING}${handle}&page=${currentPage}`, API_OPTIONS);
            if (!warningResponse.ok) throw new Error(`Solved Warning API 요청 실패: ${warningResponse.status}`);
            const warningData = await warningResponse.json();
            solvedWarningProblems.push(...warningData.items);
            if (warningData.items.length < 50) break;
            const lowestWarningLevel = warningData.items[warningData.items.length - 1].level;
            const potentialCutoff = allSolvedProblems[TOP_K + solvedWarningProblems.length];
            if (potentialCutoff && lowestWarningLevel < potentialCutoff) break;
            currentPage++;
        }

        const solvedWarningCounts = {};
        solvedWarningProblems.forEach(p => { solvedWarningCounts[p.level] = (solvedWarningCounts[p.level] || 0) + 1; });

        const validRatingProblems = [];
        for (const level of allSolvedProblems) {
            if (solvedWarningCounts[level] > 0) {
                solvedWarningCounts[level]--;
            } else {
                validRatingProblems.push(level);
            }
        }

        const topRatings = validRatingProblems.slice(0, TOP_K).map(calculateOverRating);
        const currentOverRating = topRatings.reduce((sum, rating) => sum + rating, 0);
        topRatings.sort((a, b) => a - b);

        const minRatingInCurrentTop = topRatings.length > 0 ? topRatings[0] : 0;

        for (let difficulty = 1; difficulty <= 30; difficulty++) {
            const resultsForDifficulty = [];
            const ratingForDifficulty = calculateOverRating(difficulty);

            // 정확한 이론상 최대 점수 계산
            const higherRatings = topRatings.filter(r => r > ratingForDifficulty);
            const remainingSlots = TOP_K - higherRatings.length;
            const theoreticalMaxRating = higherRatings.reduce((a, b) => a + b, 0) + (ratingForDifficulty * remainingSlots);

            for (const target of TARGET_RATINGS) {
                // 1. '이미 달성'을 최우선으로 확인
                if (currentOverRating >= target) {
                    resultsForDifficulty.push("<ac>이미 달성했습니다!</ac>");
                    continue;
                }
                // 2. 정확한 이론상 최댓값으로 도달 가능성 판별
                if (theoreticalMaxRating < target) {
                    resultsForDifficulty.push("<wa>도달 불가능</wa>");
                    continue;
                }
                // 3. 무한 루프 방지
                if (ratingForDifficulty <= minRatingInCurrentTop && topRatings.length >= TOP_K) {
                    resultsForDifficulty.push("<wa>도달 불가능</wa>");
                    continue;
                }

                let neededProblems = 0;
                let tempRating = currentOverRating;
                let tempTopRatings = [...topRatings];
                let isReachableWithCurrentDifficulty = true; // Flag to track reachability
                let problemsToSolveAtThisDifficulty = 0;

                while (tempRating < target) {
                    const minRatingInTop = tempTopRatings.length > 0 ? tempTopRatings[0] : 0;
                    if (tempTopRatings.length < TOP_K) {
                        tempRating += ratingForDifficulty;
                    } else {
                        tempRating += ratingForDifficulty - minRatingInTop;
                        tempTopRatings.shift();
                    }
                    const index = tempTopRatings.findIndex(r => r > ratingForDifficulty);
                    if (index === -1) {
                        tempTopRatings.push(ratingForDifficulty);
                    } else {
                        tempTopRatings.splice(index, 0, ratingForDifficulty);
                    }
                    neededProblems++;
                    problemsToSolveAtThisDifficulty++;

                    const effectiveAvailable = effectiveAvailableProblemsByLevel.get(difficulty) || 0;
                    if (problemsToSolveAtThisDifficulty > effectiveAvailable) {
                        isReachableWithCurrentDifficulty = false;
                        break; 
                    }
                }

                if (!isReachableWithCurrentDifficulty) {
                    resultsForDifficulty.push("<wa>도달 불가능 (문제 부족)</wa>");
                } else {
                    resultsForDifficulty.push(`${neededProblems} 문제 남음`);
                }
            }
            preCalculatedResults[difficulty] = resultsForDifficulty;
        }
        
        difficultySlider.value = 30;
        const initialTierInfo = getTierInfo(30);
        difficultyTierImage.src = initialTierInfo.src;
        difficultyTierImage.alt = initialTierInfo.alt;
        updateResultDisplay(handle, currentOverRating, 30);
        difficultySelector.style.display = 'block';
        // 초기 슬라이더 위치에 티어 이미지 배치
        const sliderWidth = difficultySlider.offsetWidth;
        const thumbPosition = sliderWidth * 97 + 1;
        movingTierIndicator.style.left = `${thumbPosition}px`;
        movingTierIndicator.style.top = '-25px'; // 티어 이미지를 슬라이더 점보다 위로 올림

    } catch (error) {
        resultDiv.innerHTML = `오류: ${error.message}`;
        console.error(error);
    }
});

difficultySlider.addEventListener('input', (e) => {
    const selectedDifficulty = parseInt(e.target.value);
    const tierInfo = getTierInfo(selectedDifficulty);
    difficultyTierImage.src = tierInfo.src;
    difficultyTierImage.alt = tierInfo.alt;
    const handle = handleInput.value;
    const currentOverRating = parseFloat(resultDiv.querySelector('h3').textContent.split(': ')[1]);
    updateResultDisplay(handle, currentOverRating, selectedDifficulty);

    // 슬라이더 점 따라 티어 이미지 이동
    const sliderWidth = difficultySlider.offsetWidth;
    const thumbPosition = ((selectedDifficulty - 1) / 29) * 97 + 1;
    movingTierIndicator.style.left = `${thumbPosition}%`;
});

function getTierInfo(level) {
    const tierNames = [
        "Unrated", "Bronze V", "Bronze IV", "Bronze III", "Bronze II", "Bronze I",
        "Silver V", "Silver IV", "Silver III", "Silver II", "Silver I",
        "Gold V", "Gold IV", "Gold III", "Gold II", "Gold I",
        "Platinum V", "Platinum IV", "Platinum III", "Platinum II", "Platinum I",
        "Diamond V", "Diamond IV", "Diamond III", "Diamond II", "Diamond I",
        "Ruby V", "Ruby IV", "Ruby III", "Ruby II", "Ruby I"
    ];
    return {
        src: `https://static.solved.ac/tier_small/${level}.svg`,
        alt: tierNames[level]
    };
}

function updateResultDisplay(handle, currentOverRating, difficulty) {
    let resultHTML = `<h3 style="text-align: center;">${handle}님의 현재 <span class="gradient-text">OVER RATING</span>: ${currentOverRating.toFixed(1)}</h3>`;
    resultHTML += '<ul>';
    const results = preCalculatedResults[difficulty];
    const tierInfo = getTierInfo(difficulty);
    TARGET_RATINGS.forEach((target, index) => {
        resultHTML += `<li><strong>${target}</strong>까지: ${String(results[index])[4] == '이' || String(results[index])[4] == '도' ? `` : `<img src="${tierInfo.src}" alt="${tierInfo.alt}" class="tier-icon">`} ${results[index]}</li>`;
    });
    resultHTML += '</ul>';
    resultDiv.innerHTML = resultHTML;
}
