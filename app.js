let stockData = {};
let currentTicker = "AAPL";
let currentView = "price"; // 'price', 'returns', or 'montecarlo'
let mcDays = 30;
let mcPaths = 100;

document.addEventListener("DOMContentLoaded", () => {
    fetchStockData();
});

async function fetchStockData() {
    try {
        const response = await fetch("stock_data.json");
        if (!response.ok) throw new Error("Failed to load stock data");
        stockData = await response.json();
        
        setupPills();
        renderDashboard(currentTicker);
        renderLeaderboard();
        setupPortfolioOptimizer();
        setupEvents();
    } catch (err) {
        console.error("Error loading JSON:", err);
        document.body.innerHTML = `<div style="color:white; padding: 2rem;">Error loading stock data: ${err.message}. Please run fetch_data.py first.</div>`;
    }
}

function setupPills() {
    const container = document.getElementById("tickerPills");
    container.innerHTML = "";

    Object.keys(stockData)
        .filter(t => t !== "portfolio_optimization")
        .forEach(ticker => {
        const btn = document.createElement("button");
        btn.className = `pill-btn ${ticker === currentTicker ? 'active' : ''}`;
        btn.innerText = ticker;
        btn.addEventListener("click", () => {
            currentTicker = ticker;
            document.querySelectorAll(".pill-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            renderDashboard(currentTicker);
        });
        container.appendChild(btn);
    });
}

function renderDashboard(ticker) {
    const data = stockData[ticker];
    if (!data) return;

    const info = data.info;

    // Update Cards
    document.getElementById("valPrice").innerText = `$${info.latest_price}`;
    document.getElementById("subPrice").innerText = `52W: $${info.low_52w} - $${info.high_52w}`;

    const retElem = document.getElementById("valReturn");
    retElem.innerText = `${info.total_return_pct >= 0 ? '+' : ''}${info.total_return_pct}%`;
    retElem.className = `card-value ${info.total_return_pct >= 0 ? 'positive' : 'negative'}`;

    document.getElementById("valSharpe").innerText = info.sharpe_ratio;
    document.getElementById("valVol").innerText = `${info.annualized_volatility_pct}%`;

    const stratElem = document.getElementById("valStrategy");
    stratElem.innerText = `${info.strategy_return_pct >= 0 ? '+' : ''}${info.strategy_return_pct}%`;
    stratElem.className = `card-value ${info.strategy_return_pct >= 0 ? 'positive' : 'negative'}`;

    // Update AI Sentiment Card
    const sentScore = info.sentiment_score ?? 0;
    const sentLabel = info.sentiment_label || "Neutral";
    const sentElem = document.getElementById("valSentiment");
    if (sentElem) {
        sentElem.innerText = `${sentScore >= 0 ? '+' : ''}${sentScore.toFixed(2)}`;
        let sentClass = "neutral-color";
        if (sentLabel === "Bullish") sentClass = "positive";
        else if (sentLabel === "Bearish") sentClass = "negative";
        sentElem.className = `card-value ${sentClass}`;
    }
    const subSent = document.getElementById("subSentiment");
    if (subSent) {
        subSent.innerText = `${sentLabel} AI Signal (${info.sentiment_bullish_pct}% Bull / ${info.sentiment_bearish_pct}% Bear)`;
    }

    renderChart(ticker);
    renderSentimentNews(ticker);
}

function gaussianRandom() {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function generateFutureBusinessDays(startDateStr, days) {
    const dates = [];
    let current = new Date(startDateStr);
    while (dates.length < days) {
        current.setDate(current.getDate() + 1);
        const dayOfWeek = current.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Skip Sunday (0) and Saturday (6)
            dates.push(current.toISOString().split("T")[0]);
        }
    }
    return dates;
}

function runMonteCarloSimulation(ticker, horizonDays, numPaths) {
    const data = stockData[ticker];
    if (!data) return null;

    const info = data.info;
    const history = data.history;
    const S0 = info.latest_price;

    let mu = info.daily_drift;
    let sigma = info.daily_volatility;

    if (mu === undefined || sigma === undefined) {
        const returns = history.map(h => h.Daily_Return).filter(r => r !== 0);
        const n = returns.length;
        mu = returns.reduce((a, b) => a + b, 0) / (n || 1);
        const variance = returns.reduce((a, b) => a + Math.pow(b - mu, 2), 0) / Math.max(n - 1, 1);
        sigma = Math.sqrt(variance);
    }

    const lastDate = history[history.length - 1].Date;
    const futureDates = [lastDate, ...generateFutureBusinessDays(lastDate, horizonDays)];

    // Simulate Geometric Brownian Motion paths
    const paths = [];
    const driftTerm = mu - 0.5 * sigma * sigma;

    for (let p = 0; p < numPaths; p++) {
        const path = [S0];
        let currentPrice = S0;
        for (let d = 1; d <= horizonDays; d++) {
            const z = gaussianRandom();
            currentPrice = currentPrice * Math.exp(driftTerm + sigma * z);
            path.push(currentPrice);
        }
        paths.push(path);
    }

    // Calculate percentiles at each day step
    const p5Series = [];
    const p50Series = [];
    const p95Series = [];

    for (let d = 0; d <= horizonDays; d++) {
        const dayPrices = paths.map(p => p[d]).sort((a, b) => a - b);
        const idx5 = Math.floor(0.05 * (numPaths - 1));
        const idx50 = Math.floor(0.50 * (numPaths - 1));
        const idx95 = Math.floor(0.95 * (numPaths - 1));

        p5Series.push(dayPrices[idx5]);
        p50Series.push(dayPrices[idx50]);
        p95Series.push(dayPrices[idx95]);
    }

    const finalPrices = paths.map(p => p[horizonDays]).sort((a, b) => a - b);
    const medianFinal = p50Series[horizonDays];
    const medianReturnPct = ((medianFinal - S0) / S0) * 100;
    const var95Pct = ((p5Series[horizonDays] - S0) / S0) * 100;
    const profitablePaths = finalPrices.filter(p => p > S0).length;
    const probProfitPct = (profitablePaths / numPaths) * 100;

    return {
        futureDates,
        paths,
        p5Series,
        p50Series,
        p95Series,
        S0,
        medianFinal,
        medianReturnPct,
        var95Pct,
        probProfitPct,
        p5Final: p5Series[horizonDays],
        p95Final: p95Series[horizonDays]
    };
}

function renderChart(ticker) {
    const data = stockData[ticker];
    if (!data) return;
    const history = data.history;

    const dates = history.map(d => d.Date);
    const prices = history.map(d => d.Close);
    const ma20 = history.map(d => d.MA_20);
    const ma50 = history.map(d => d.MA_50);
    const returns = history.map(d => d.Daily_Return * 100);

    const titleElem = document.getElementById("chartTitle");
    const mcControls = document.getElementById("mcControls");
    const mcMetrics = document.getElementById("mcMetricsPanel");

    if (currentView === "montecarlo") {
        if (mcControls) mcControls.style.display = "flex";
        if (mcMetrics) mcMetrics.style.display = "grid";
    } else {
        if (mcControls) mcControls.style.display = "none";
        if (mcMetrics) mcMetrics.style.display = "none";
    }
    
    let traces = [];
    if (currentView === "price") {
        titleElem.innerText = `${ticker} — Price History & Moving Average Strategy`;
        traces = [
            {
                x: dates,
                y: prices,
                type: 'scatter',
                mode: 'lines',
                name: 'Close Price',
                line: { color: '#6366f1', width: 2 }
            },
            {
                x: dates,
                y: ma20,
                type: 'scatter',
                mode: 'lines',
                name: '20-Day MA',
                line: { color: '#06b6d4', width: 1.5, dash: 'dot' }
            },
            {
                x: dates,
                y: ma50,
                type: 'scatter',
                mode: 'lines',
                name: '50-Day MA (Trend)',
                line: { color: '#10b981', width: 1.5 }
            }
        ];
    } else if (currentView === "returns") {
        titleElem.innerText = `${ticker} — Daily Return Volatility (%)`;
        traces = [
            {
                x: dates,
                y: returns,
                type: 'bar',
                name: 'Daily Return %',
                marker: {
                    color: returns.map(r => r >= 0 ? '#10b981' : '#f43f5e')
                }
            }
        ];
    } else if (currentView === "montecarlo") {
        titleElem.innerText = `${ticker} — Monte Carlo Simulation (${mcDays}D Horizon, ${mcPaths} Paths)`;
        const sim = runMonteCarloSimulation(ticker, mcDays, mcPaths);

        if (sim) {
            const medSign = sim.medianReturnPct >= 0 ? "+" : "";
            const elMedian = document.getElementById("mcValMedian");
            if (elMedian) {
                elMedian.innerText = `$${sim.medianFinal.toFixed(2)} (${medSign}${sim.medianReturnPct.toFixed(1)}%)`;
                elMedian.className = `mc-box-val ${sim.medianReturnPct >= 0 ? 'positive' : 'negative'}`;
            }

            const elVaR = document.getElementById("mcValVaR");
            if (elVaR) {
                elVaR.innerText = `${sim.var95Pct.toFixed(1)}%`;
                elVaR.className = `mc-box-val ${sim.var95Pct >= 0 ? 'positive' : 'negative'}`;
            }

            const elProb = document.getElementById("mcValProb");
            if (elProb) {
                elProb.innerText = `${sim.probProfitPct.toFixed(1)}%`;
                elProb.className = `mc-box-val ${sim.probProfitPct >= 50 ? 'positive' : 'negative'}`;
            }

            const elCone = document.getElementById("mcValCone");
            if (elCone) {
                elCone.innerText = `$${sim.p5Final.toFixed(2)} - $${sim.p95Final.toFixed(2)}`;
            }

            // Recent 45 trading days for context
            const histSlice = history.slice(-45);
            const histDates = histSlice.map(d => d.Date);
            const histPrices = histSlice.map(d => d.Close);

            traces = [];

            // 1. Historical Context Line
            traces.push({
                x: histDates,
                y: histPrices,
                type: 'scatter',
                mode: 'lines',
                name: 'Recent History',
                line: { color: '#94a3b8', width: 1.5 }
            });

            // 2. Individual Simulated Paths (render sample up to 50 paths for performance)
            const samplePaths = sim.paths.slice(0, Math.min(sim.paths.length, 50));
            samplePaths.forEach((path) => {
                traces.push({
                    x: sim.futureDates,
                    y: path,
                    type: 'scatter',
                    mode: 'lines',
                    line: { color: 'rgba(99, 102, 241, 0.12)', width: 1 },
                    showlegend: false,
                    hoverinfo: 'skip'
                });
            });

            // 3. Lower 5th Percentile Bound (Bear Floor)
            traces.push({
                x: sim.futureDates,
                y: sim.p5Series,
                type: 'scatter',
                mode: 'lines',
                name: 'Worst 5% (Bear Bound)',
                line: { color: '#f43f5e', width: 2, dash: 'dash' }
            });

            // 4. Upper 95th Percentile Bound (Bull Ceiling with confidence fill)
            traces.push({
                x: sim.futureDates,
                y: sim.p95Series,
                type: 'scatter',
                mode: 'lines',
                name: 'Best 95% (Bull Bound)',
                fill: 'tonexty',
                fillcolor: 'rgba(99, 102, 241, 0.08)',
                line: { color: '#06b6d4', width: 2, dash: 'dash' }
            });

            // 5. 50th Percentile Median Expected Trajectory
            traces.push({
                x: sim.futureDates,
                y: sim.p50Series,
                type: 'scatter',
                mode: 'lines',
                name: 'Expected Path (Median)',
                line: { color: '#10b981', width: 3 }
            });
        }
    }

    const layout = {
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { color: '#94a3b8', family: 'Outfit, sans-serif' },
        margin: { l: 45, r: 20, t: 10, b: 45 },
        xaxis: {
            gridcolor: 'rgba(255,255,255,0.05)',
            zerolinecolor: 'rgba(255,255,255,0.1)'
        },
        yaxis: {
            gridcolor: 'rgba(255,255,255,0.05)',
            zerolinecolor: 'rgba(255,255,255,0.1)'
        },
        legend: {
            orientation: 'h',
            y: 1.15
        }
    };

    const config = { responsive: true, displayModeBar: false };

    Plotly.newPlot('plotlyChart', traces, layout, config);
}

function renderLeaderboard() {
    const listContainer = document.getElementById("leaderboardList");
    listContainer.innerHTML = "";

    const sorted = Object.keys(stockData)
        .filter(t => t !== "portfolio_optimization")
        .map(t => ({ ticker: t, ...stockData[t].info }))
        .sort((a, b) => b.sharpe_ratio - a.sharpe_ratio);

    sorted.forEach((item, index) => {
        const div = document.createElement("div");
        div.className = "lb-item";

        let sentClass = "tag-neutral";
        if (item.sentiment_label === "Bullish") sentClass = "tag-bullish";
        else if (item.sentiment_label === "Bearish") sentClass = "tag-bearish";

        div.innerHTML = `
            <span class="lb-name">#${index + 1} ${item.ticker}</span>
            <div class="lb-metrics">
                <span class="${item.total_return_pct >= 0 ? 'positive' : 'negative'}">${item.total_return_pct}%</span>
                <span style="color: #06b6d4;">SR: ${item.sharpe_ratio}</span>
                <span class="sentiment-badge ${sentClass}" style="font-size: 0.65rem; padding: 1px 7px;">${item.sentiment_label || 'Neutral'}</span>
            </div>
        `;
        listContainer.appendChild(div);
    });
}

function renderSentimentNews(ticker) {
    const data = stockData[ticker];
    if (!data || !data.sentiment) return;

    const sent = data.sentiment;

    // Update meter bar fills
    const barBullish = document.getElementById("barBullish");
    const barNeutral = document.getElementById("barNeutral");
    const barBearish = document.getElementById("barBearish");

    if (barBullish && barNeutral && barBearish) {
        barBullish.style.width = `${sent.bullish_pct}%`;
        barNeutral.style.width = `${sent.neutral_pct}%`;
        barBearish.style.width = `${sent.bearish_pct}%`;
    }

    const statsElem = document.getElementById("meterStats");
    if (statsElem) {
        statsElem.innerHTML = `
            <span class="meter-stat green"><span class="dot green"></span> Bullish: ${sent.bullish_pct}%</span>
            <span class="meter-stat slate"><span class="dot slate"></span> Neutral: ${sent.neutral_pct}%</span>
            <span class="meter-stat red"><span class="dot red"></span> Bearish: ${sent.bearish_pct}%</span>
        `;
    }

    // Render news cards
    const feed = document.getElementById("newsFeed");
    if (!feed) return;
    feed.innerHTML = "";

    const articles = sent.articles || [];
    if (articles.length === 0) {
        feed.innerHTML = `<div style="color: var(--text-muted); padding: 1rem;">No recent news articles detected for this asset.</div>`;
        return;
    }

    articles.forEach(art => {
        const card = document.createElement("a");
        card.className = "news-item-card";
        card.href = art.url;
        card.target = "_blank";
        card.rel = "noopener noreferrer";

        let tagClass = "tag-neutral";
        let dotClass = "slate";
        if (art.label === "Bullish") {
            tagClass = "tag-bullish";
            dotClass = "green";
        } else if (art.label === "Bearish") {
            tagClass = "tag-bearish";
            dotClass = "red";
        }

        const scoreSign = art.score >= 0 ? "+" : "";

        card.innerHTML = `
            <div class="news-item-top">
                <span class="news-meta">
                    <span class="news-publisher">${art.publisher}</span> • ${art.date}
                </span>
                <span class="sentiment-badge ${tagClass}">
                    <span class="dot ${dotClass}"></span> ${art.label}
                </span>
            </div>
            <h3 class="news-title">${art.title}</h3>
            <p class="news-snippet">${art.summary || 'Click to read full coverage on market network.'}</p>
            <div class="news-item-bottom">
                <span class="nlp-score-pill" style="color: ${art.score > 0 ? '#10b981' : (art.score < 0 ? '#f43f5e' : '#94a3b8')}">
                    NLP Score: ${scoreSign}${art.score.toFixed(2)}
                </span>
                <span>Read Story ↗</span>
            </div>
        `;
        feed.appendChild(card);
    });
}

function setupEvents() {
    const btnPrice = document.getElementById("btnPrice");
    const btnReturns = document.getElementById("btnReturns");
    const btnMonteCarlo = document.getElementById("btnMonteCarlo");
    const btnRunMC = document.getElementById("btnRunMC");

    btnPrice.addEventListener("click", () => {
        currentView = "price";
        btnPrice.classList.add("active");
        btnReturns.classList.remove("active");
        if (btnMonteCarlo) btnMonteCarlo.classList.remove("active");
        renderChart(currentTicker);
    });

    btnReturns.addEventListener("click", () => {
        currentView = "returns";
        btnReturns.classList.add("active");
        btnPrice.classList.remove("active");
        if (btnMonteCarlo) btnMonteCarlo.classList.remove("active");
        renderChart(currentTicker);
    });

    if (btnMonteCarlo) {
        btnMonteCarlo.addEventListener("click", () => {
            currentView = "montecarlo";
            btnMonteCarlo.classList.add("active");
            btnPrice.classList.remove("active");
            btnReturns.classList.remove("active");
            renderChart(currentTicker);
        });
    }

    // Monte Carlo Horizon Pills
    document.querySelectorAll("#mcHorizonPills .mc-pill-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll("#mcHorizonPills .mc-pill-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            mcDays = parseInt(btn.getAttribute("data-days")) || 30;
            renderChart(currentTicker);
        });
    });

    // Monte Carlo Paths Pills
    document.querySelectorAll("#mcPathsPills .mc-pill-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll("#mcPathsPills .mc-pill-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            mcPaths = parseInt(btn.getAttribute("data-paths")) || 100;
            renderChart(currentTicker);
        });
    });

    if (btnRunMC) {
        btnRunMC.addEventListener("click", () => {
            renderChart(currentTicker);
        });
    }
}

let currentWeights = {};
let portfolioData = null;

function setupPortfolioOptimizer() {
    portfolioData = stockData["portfolio_optimization"];
    if (!portfolioData) return;

    const defaultWeights = portfolioData.max_sharpe.weights;
    currentWeights = { ...defaultWeights };

    renderPortfolioSliders();
    updatePortfolioCalculations();
    renderFrontierChart();
    setupPortfolioPresetEvents();
}

function renderPortfolioSliders() {
    const container = document.getElementById("slidersContainer");
    if (!container || !portfolioData) return;
    container.innerHTML = "";

    const tickers = Object.keys(portfolioData.ann_returns);

    tickers.forEach(ticker => {
        const weightPct = Math.round((currentWeights[ticker] || 0) * 100);
        const row = document.createElement("div");
        row.className = "alloc-slider-row";
        row.innerHTML = `
            <div class="slider-label-line">
                <span>${ticker}</span>
                <span class="slider-weight-val" id="weightVal_${ticker}">${weightPct}%</span>
            </div>
            <input type="range" class="alloc-slider" id="slider_${ticker}" min="0" max="100" value="${weightPct}">
        `;
        container.appendChild(row);

        const slider = row.querySelector(`#slider_${ticker}`);
        slider.addEventListener("input", (e) => {
            const rawVal = parseInt(e.target.value);
            document.getElementById(`weightVal_${ticker}`).innerText = `${rawVal}%`;
            currentWeights[ticker] = rawVal / 100;
            updatePortfolioCalculations();
            updateFrontierCurrentPoint();
        });
    });
}

function updatePortfolioCalculations() {
    if (!portfolioData) return null;
    const tickers = Object.keys(portfolioData.ann_returns);

    const rawSum = tickers.reduce((sum, t) => sum + (currentWeights[t] || 0), 0);
    const pill = document.getElementById("totalWeightPill");
    if (pill) {
        const sumPct = Math.round(rawSum * 100);
        pill.innerText = `Total: ${sumPct}%`;
        if (sumPct === 100) {
            pill.style.background = "rgba(16, 185, 129, 0.15)";
            pill.style.color = "var(--accent-emerald)";
            pill.style.borderColor = "rgba(16, 185, 129, 0.3)";
        } else {
            pill.style.background = "rgba(244, 63, 94, 0.15)";
            pill.style.color = "var(--accent-rose)";
            pill.style.borderColor = "rgba(244, 63, 94, 0.3)";
        }
    }

    const normWeights = {};
    const effectiveSum = rawSum > 0 ? rawSum : 1;
    tickers.forEach(t => {
        normWeights[t] = (currentWeights[t] || 0) / effectiveSum;
    });

    // 1. Portfolio Return: sum(w_i * mu_i)
    let pReturn = 0;
    tickers.forEach(t => {
        pReturn += normWeights[t] * portfolioData.ann_returns[t];
    });

    // 2. Portfolio Volatility: sqrt(w^T * Cov * w)
    let pVariance = 0;
    tickers.forEach(t1 => {
        tickers.forEach(t2 => {
            pVariance += normWeights[t1] * normWeights[t2] * portfolioData.cov_matrix[t1][t2];
        });
    });
    const pVol = Math.sqrt(Math.max(0, pVariance));

    // 3. Sharpe Ratio
    const rf = portfolioData.rf_annual || 0.045;
    const pSharpe = pVol > 0 ? (pReturn - rf) / pVol : 0;

    // 4. Diversification Benefit: sum(w_i * sigma_i) - pVol
    let weightedIndividualVol = 0;
    tickers.forEach(t => {
        const singleVol = Math.sqrt(portfolioData.cov_matrix[t][t]);
        weightedIndividualVol += normWeights[t] * singleVol;
    });
    const divBenefit = Math.max(0, weightedIndividualVol - pVol);

    // Update KPIs
    const elRet = document.getElementById("pkpiReturn");
    if (elRet) elRet.innerText = `${pReturn >= 0 ? '+' : ''}${(pReturn * 100).toFixed(2)}%`;

    const elVol = document.getElementById("pkpiVol");
    if (elVol) elVol.innerText = `${(pVol * 100).toFixed(2)}%`;

    const elSharpe = document.getElementById("pkpiSharpe");
    if (elSharpe) elSharpe.innerText = pSharpe.toFixed(2);

    const elDiv = document.getElementById("pkpiDivBenefit");
    if (elDiv) elDiv.innerText = `-${(divBenefit * 100).toFixed(2)}% Risk`;

    return {
        returnPct: pReturn * 100,
        volPct: pVol * 100,
        sharpe: pSharpe
    };
}

function renderFrontierChart() {
    if (!portfolioData) return;
    const frontierElem = document.getElementById("frontierChart");
    if (!frontierElem) return;

    const samples = portfolioData.frontier_sample || [];
    const sampleVols = samples.map(s => s.volatility_pct);
    const sampleRets = samples.map(s => s.return_pct);
    const sampleSharpes = samples.map(s => s.sharpe_ratio);

    const maxS = portfolioData.max_sharpe;
    const minV = portfolioData.min_volatility;
    const curStats = updatePortfolioCalculations();

    const traces = [
        // 1. Simulated Portfolios Cloud
        {
            x: sampleVols,
            y: sampleRets,
            mode: 'markers',
            name: 'Simulated Portfolios',
            marker: {
                color: sampleSharpes,
                colorscale: [
                    [0, '#312e81'],
                    [0.5, '#6366f1'],
                    [1, '#06b6d4']
                ],
                size: 6,
                opacity: 0.5,
                colorbar: {
                    title: { text: 'Sharpe', font: { color: '#94a3b8', size: 10 } },
                    tickfont: { color: '#94a3b8', size: 9 },
                    thickness: 10,
                    len: 0.7
                }
            },
            text: sampleSharpes.map(s => `Sharpe: ${s.toFixed(2)}`),
            hoverinfo: 'x+y+text'
        },
        // 2. Min Volatility Point
        {
            x: [minV.volatility_pct],
            y: [minV.return_pct],
            mode: 'markers+text',
            name: 'Min Volatility',
            text: ['🛡️ Min Vol'],
            textposition: 'bottom right',
            textfont: { color: '#06b6d4', size: 11, family: 'Outfit, sans-serif' },
            marker: { symbol: 'diamond', size: 14, color: '#06b6d4' }
        },
        // 3. Max Sharpe Point
        {
            x: [maxS.volatility_pct],
            y: [maxS.return_pct],
            mode: 'markers+text',
            name: 'Max Sharpe (Optimal)',
            text: ['⭐ Max Sharpe'],
            textposition: 'top left',
            textfont: { color: '#f59e0b', size: 11, family: 'Outfit, sans-serif' },
            marker: { symbol: 'star', size: 16, color: '#f59e0b', line: { color: '#ffffff', width: 1.5 } }
        },
        // 4. Current User Selected Allocation
        {
            x: [curStats ? curStats.volPct : maxS.volatility_pct],
            y: [curStats ? curStats.returnPct : maxS.return_pct],
            mode: 'markers+text',
            name: 'Current Portfolio',
            text: ['📍 Current'],
            textposition: 'top right',
            textfont: { color: '#ec4899', size: 12, family: 'Outfit, sans-serif' },
            marker: { symbol: 'circle', size: 14, color: '#ec4899', line: { color: '#ffffff', width: 2 } }
        }
    ];

    const layout = {
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { color: '#94a3b8', family: 'Outfit, sans-serif' },
        margin: { l: 50, r: 20, t: 20, b: 50 },
        xaxis: {
            title: { text: 'Annualized Risk (Volatility \u03c3%)', font: { size: 11 } },
            gridcolor: 'rgba(255,255,255,0.05)',
            zerolinecolor: 'rgba(255,255,255,0.1)'
        },
        yaxis: {
            title: { text: 'Expected Return (%)', font: { size: 11 } },
            gridcolor: 'rgba(255,255,255,0.05)',
            zerolinecolor: 'rgba(255,255,255,0.1)'
        },
        legend: {
            orientation: 'h',
            y: 1.15,
            x: 0
        }
    };

    const config = { responsive: true, displayModeBar: false };
    Plotly.newPlot('frontierChart', traces, layout, config);
}

function updateFrontierCurrentPoint() {
    const curStats = updatePortfolioCalculations();
    if (!curStats) return;
    Plotly.restyle('frontierChart', {
        x: [[curStats.volPct]],
        y: [[curStats.returnPct]]
    }, [3]);
}

function setupPortfolioPresetEvents() {
    const btnMaxSharpe = document.getElementById("btnPresetMaxSharpe");
    const btnMinVol = document.getElementById("btnPresetMinVol");
    const btnEqual = document.getElementById("btnPresetEqual");

    const clearActive = () => {
        [btnMaxSharpe, btnMinVol, btnEqual].forEach(b => { if (b) b.classList.remove("active"); });
    };

    if (btnMaxSharpe) {
        btnMaxSharpe.addEventListener("click", () => {
            clearActive();
            btnMaxSharpe.classList.add("active");
            currentWeights = { ...portfolioData.max_sharpe.weights };
            renderPortfolioSliders();
            updatePortfolioCalculations();
            updateFrontierCurrentPoint();
        });
    }

    if (btnMinVol) {
        btnMinVol.addEventListener("click", () => {
            clearActive();
            btnMinVol.classList.add("active");
            currentWeights = { ...portfolioData.min_volatility.weights };
            renderPortfolioSliders();
            updatePortfolioCalculations();
            updateFrontierCurrentPoint();
        });
    }

    if (btnEqual) {
        btnEqual.addEventListener("click", () => {
            clearActive();
            btnEqual.classList.add("active");
            currentWeights = { ...portfolioData.equal_weight.weights };
            renderPortfolioSliders();
            updatePortfolioCalculations();
            updateFrontierCurrentPoint();
        });
    }
}
