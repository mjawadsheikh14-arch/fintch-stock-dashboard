let stockData = {};
let currentTicker = "AAPL";
let currentView = "price"; // 'price' or 'returns'

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
        setupEvents();
    } catch (err) {
        console.error("Error loading JSON:", err);
        document.body.innerHTML = `<div style="color:white; padding: 2rem;">Error loading stock data: ${err.message}. Please run fetch_data.py first.</div>`;
    }
}

function setupPills() {
    const container = document.getElementById("tickerPills");
    container.innerHTML = "";

    Object.keys(stockData).forEach(ticker => {
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

function renderChart(ticker) {
    const data = stockData[ticker];
    const history = data.history;

    const dates = history.map(d => d.Date);
    const prices = history.map(d => d.Close);
    const ma20 = history.map(d => d.MA_20);
    const ma50 = history.map(d => d.MA_50);
    const returns = history.map(d => d.Daily_Return * 100);

    const titleElem = document.getElementById("chartTitle");
    
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
    } else {
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

    btnPrice.addEventListener("click", () => {
        currentView = "price";
        btnPrice.classList.add("active");
        btnReturns.classList.remove("active");
        renderChart(currentTicker);
    });

    btnReturns.addEventListener("click", () => {
        currentView = "returns";
        btnReturns.classList.add("active");
        btnPrice.classList.remove("active");
        renderChart(currentTicker);
    });
}
