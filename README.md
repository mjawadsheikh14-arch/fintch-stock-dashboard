# 📈 QuantPulse — US Tech Stock Analytics & Quantitative Strategy Engine

[![Live Demo](https://img.shields.io/badge/Live_Demo-fintch--stock--dashboard.vercel.app-6366f1?style=for-the-badge&logo=vercel&logoColor=white)](https://fintch-stock-dashboard.vercel.app/)
[![Python](https://img.shields.io/badge/Python-3.12-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![Status](https://img.shields.io/badge/Deployment-Active-10b981?style=for-the-badge)](https://fintch-stock-dashboard.vercel.app/)

> 🚀 **Live Web App:** **[https://fintch-stock-dashboard.vercel.app/](https://fintch-stock-dashboard.vercel.app/)**

A full-stack quantitative financial analytics dashboard and backtesting engine built to evaluate US mega-cap technology equities (**AAPL, NVDA, MSFT, TSLA, GOOGL, AMZN**). 

QuantPulse integrates **statistical risk modeling**, **algorithmic trading strategy backtests**, **stochastic Monte Carlo simulations (Geometric Brownian Motion)**, and **domain-specific Natural Language Processing (NLP) sentiment analysis** into an interactive, glassmorphic dark-mode web application.

---

## ✨ Key Features

- **📊 Comprehensive Risk & Performance Engine:**
  - 1-Year Cumulative Total Return % vs. Buy & Hold benchmark.
  - 52-Week Price Range tracking.
  - **Annualized Volatility** computed via standard deviation of daily logarithmic returns scaled across 252 trading days ($\sigma \times \sqrt{252}$).
  - **Sharpe Ratio** evaluating excess return over the risk-free rate ($R_f = 4.5\%$).

- **⚡ Algorithmic Trading Strategy Backtester:**
  - Backtests the classical **Golden Cross / Death Cross** trend-following strategy using a 20-Day Simple Moving Average (SMA) crossing a 50-Day SMA.
  - Computes cumulative compounded return comparison vs. the standard asset trajectory.

- **🤖 Quantitative Financial NLP Sentiment Engine:**
  - Real-time financial news ingestion via `yfinance`.
  - Scored using a domain-specific financial lexicon modeled after the **Loughran-McDonald Financial Dictionary**.
  - Context-aware NLP with **3-token backward negation modeling** (e.g., *"not declining"*, *"fails to meet"*) and **intensifier multipliers** (*"record"*, *"surging"*).
  - Calculates normalized polarity scores in range $[-1.0, +1.0]$, alongside Bullish / Neutral / Bearish distribution meters and clickable headline cards.

- **🎲 Monte Carlo Price Simulation & Tail Risk Engine:**
  - Projects 50 to 250 stochastic future asset trajectories over 30, 60, and 90 trading days using **Geometric Brownian Motion (GBM)**.
  - Generates standard normal random market shocks ($Z \sim \mathcal{N}(0, 1)$) via the **Box-Muller transformation**.
  - Calculates probabilistic risk metrics: **Expected Median Target**, **95% Value at Risk (VaR)**, **Probability of Profit %**, and a **95% Confidence Interval Target Cone** (5th percentile floor to 95th percentile ceiling).

- **💼 Modern Portfolio Theory & Markowitz Efficient Frontier:**
  - Evaluates multi-asset covariance matrix $\boldsymbol{\Sigma}$ across all 6 US Tech assets.
  - Simulates 1,200 random asset allocation vectors to map the **Markowitz Efficient Frontier**.
  - Identifies the **Maximum Sharpe Ratio Portfolio (Optimal Risk-Adjusted Growth)** and **Minimum Volatility Portfolio (Capital Preservation)**.
  - Real-time client-side portfolio simulator with interactive allocation sliders, live diversification risk reduction KPI, and dynamic Frontier scatter chart.

- **🎨 Modern Glassmorphic UI & Visualizations:**
  - Interactive charts powered by **Plotly.js** (toggle between Price + Moving Averages, Daily Returns, and Monte Carlo Fan Charts).
  - Real-time **Risk vs. Return Leaderboard** ranking assets dynamically by Sharpe Ratio and AI signal.
  - Responsive dark-mode interface with CSS glassmorphism.

---

## 📐 Mathematical & Financial Formulations

### 1. Annualized Volatility
$$\sigma_{\text{ann}} = \sigma_{\text{daily}} \times \sqrt{252}$$
Where $\sigma_{\text{daily}} = \sqrt{\frac{1}{N-1} \sum_{i=1}^N (R_i - \bar{R})^2}$, scaling daily standard deviation across the 252 trading days in a standard US exchange calendar year.

### 2. Sharpe Ratio
$$\text{Sharpe Ratio} = \frac{\bar{R}_p - R_f}{\sigma_p}$$
Measures the risk-adjusted excess return per unit of portfolio volatility relative to a risk-free rate assumption ($R_f = 4.5\%$).

### 3. Quantitative NLP Polarity Score
$$S_{\text{norm}} = \frac{\sum w_{\text{pos}} - \sum w_{\text{neg}}}{\sqrt{(\sum w)^2 + 15}}$$
Where $w$ represents domain-weighted sentiment tokens adjusted for preceding negation operators:
$$w_{\text{negated}} = -0.8 \times w_{\text{base}}$$

### 4. Geometric Brownian Motion (Monte Carlo Price Paths)
$$S_{t+1} = S_t \times \exp\left(\left(\mu - \frac{1}{2}\sigma^2\right) + \sigma \times Z\right)$$
Where $\mu$ is historical daily drift, $\sigma$ is asset daily volatility, and $Z \sim \mathcal{N}(0, 1)$ is sampled via the Box-Muller transform:
$$Z = \sqrt{-2 \ln(U_1)} \cos(2\pi U_2) \quad \text{for } U_1, U_2 \sim \text{Uniform}(0, 1)$$

### 5. Markowitz Modern Portfolio Theory (Nobel Prize)
$$\mathbb{E}[R_p] = \sum_{i=1}^n w_i \mathbb{E}[R_i] = \mathbf{w}^T \boldsymbol{\mu}$$
$$\sigma_p = \sqrt{\mathbf{w}^T \boldsymbol{\Sigma} \mathbf{w}} = \sqrt{\sum_{i=1}^n \sum_{j=1}^n w_i w_j \text{Cov}(R_i, R_j)}$$
$$\text{Diversification Benefit} = \sum_{i=1}^n w_i \sigma_i - \sigma_p$$
Where $\mathbf{w}$ represents normalized portfolio weight vectors ($\sum w_i = 1$), and $\boldsymbol{\Sigma}$ is the annualized asset covariance matrix, demonstrating how cross-asset covariance cancels idiosyncratic volatility.

---

## 🛠️ Tech Stack & Architecture

- **Backend & Quantitative Modeling:** Python 3.12, `pandas`, `numpy`, `yfinance`
- **NLP & Text Processing:** Domain-specific Loughran-McDonald lexicon tokenizer with regex and context window analysis (`sentiment.py`)
- **Frontend & Visualization:** Vanilla JavaScript (ES6+), Plotly.js, HTML5, CSS3 (Glassmorphism, CSS Grid, Flexbox)

---

## 🚀 Local Development Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/fintech-stock-dashboard.git
   cd fintech-stock-dashboard
   ```

2. **Install Python dependencies:**
   ```bash
   pip install yfinance pandas numpy
   ```

3. **Fetch latest market data & run NLP analysis:**
   ```bash
   python fetch_data.py
   ```

4. **Launch the local dashboard server:**
   ```bash
   python -m http.server 8000
   ```
   Open `http://localhost:8000` in your web browser.

---

## 👤 Author

- **MJ** — High School Student & Aspiring Computer Science / Financial Data Science Major
