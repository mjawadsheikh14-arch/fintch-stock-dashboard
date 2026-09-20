import yfinance as yf
import pandas as pd
import numpy as np
import json
import os
from sentiment import analyze_news_items

# Define US Tech Stock Tickers
TICKERS = ["AAPL", "NVDA", "MSFT", "TSLA", "GOOGL", "AMZN"]
PERIOD = "1y"

def compute_markowitz_portfolio(returns_df, tickers, rf_annual=0.045):
    print("Computing Markowitz Modern Portfolio Theory & Efficient Frontier...")
    mean_daily = returns_df[tickers].mean()
    ann_returns = mean_daily * 252
    
    cov_daily = returns_df[tickers].cov()
    cov_ann = cov_daily * 252
    
    num_portfolios = 1200
    np.random.seed(42)
    
    weights_record = []
    returns_record = []
    volatility_record = []
    sharpe_record = []
    
    num_assets = len(tickers)
    
    for _ in range(num_portfolios):
        w = np.random.random(num_assets)
        w = w / np.sum(w)
        
        p_ret = float(np.dot(w, ann_returns))
        p_vol = float(np.sqrt(np.dot(w.T, np.dot(cov_ann, w))))
        p_sharpe = (p_ret - rf_annual) / p_vol if p_vol > 0 else 0.0
        
        weights_record.append(w)
        returns_record.append(p_ret)
        volatility_record.append(p_vol)
        sharpe_record.append(p_sharpe)
        
    returns_arr = np.array(returns_record)
    volatility_arr = np.array(volatility_record)
    sharpe_arr = np.array(sharpe_record)
    
    max_sharpe_idx = int(np.argmax(sharpe_arr))
    max_sharpe_weights = {tickers[i]: round(float(weights_record[max_sharpe_idx][i]), 4) for i in range(num_assets)}
    max_sharpe_portfolio = {
        "weights": max_sharpe_weights,
        "return_pct": round(float(returns_arr[max_sharpe_idx] * 100), 2),
        "volatility_pct": round(float(volatility_arr[max_sharpe_idx] * 100), 2),
        "sharpe_ratio": round(float(sharpe_arr[max_sharpe_idx]), 2)
    }
    
    min_vol_idx = int(np.argmin(volatility_arr))
    min_vol_weights = {tickers[i]: round(float(weights_record[min_vol_idx][i]), 4) for i in range(num_assets)}
    min_vol_portfolio = {
        "weights": min_vol_weights,
        "return_pct": round(float(returns_arr[min_vol_idx] * 100), 2),
        "volatility_pct": round(float(volatility_arr[min_vol_idx] * 100), 2),
        "sharpe_ratio": round(float(sharpe_arr[min_vol_idx]), 2)
    }
    
    eq_w = np.ones(num_assets) / num_assets
    eq_ret = float(np.dot(eq_w, ann_returns))
    eq_vol = float(np.sqrt(np.dot(eq_w.T, np.dot(cov_ann, eq_w))))
    eq_sharpe = (eq_ret - rf_annual) / eq_vol if eq_vol > 0 else 0.0
    equal_weight_portfolio = {
        "weights": {tickers[i]: round(1.0 / num_assets, 4) for i in range(num_assets)},
        "return_pct": round(float(eq_ret * 100), 2),
        "volatility_pct": round(float(eq_vol * 100), 2),
        "sharpe_ratio": round(float(eq_sharpe), 2)
    }
    
    step = max(1, num_portfolios // 200)
    frontier_sample = [
        {
            "volatility_pct": round(float(volatility_arr[i] * 100), 2),
            "return_pct": round(float(returns_arr[i] * 100), 2),
            "sharpe_ratio": round(float(sharpe_arr[i]), 2)
        }
        for i in range(0, num_portfolios, step)
    ]
    
    asset_stats = {
        t: {
            "return_pct": round(float(ann_returns[t] * 100), 2),
            "volatility_pct": round(float(np.sqrt(cov_ann.loc[t, t]) * 100), 2),
            "sharpe_ratio": round(float((ann_returns[t] - rf_annual) / np.sqrt(cov_ann.loc[t, t])), 2)
        }
        for t in tickers
    }
    
    cov_dict = {t1: {t2: float(cov_ann.loc[t1, t2]) for t2 in tickers} for t1 in tickers}
    ann_returns_dict = {t: float(ann_returns[t]) for t in tickers}
    
    return {
        "max_sharpe": max_sharpe_portfolio,
        "min_volatility": min_vol_portfolio,
        "equal_weight": equal_weight_portfolio,
        "frontier_sample": frontier_sample,
        "asset_stats": asset_stats,
        "cov_matrix": cov_dict,
        "ann_returns": ann_returns_dict,
        "rf_annual": rf_annual
    }

def analyze_stocks():
    print("Fetching US Tech Stock data...")
    data = {}
    returns_series = {}
    
    rf_daily = 0.045 / 252

    for ticker in TICKERS:
        print(f"Processing {ticker}...")
        stock = yf.Ticker(ticker)
        df = stock.history(period=PERIOD)

        if df.empty:
            continue

        df.reset_index(inplace=True)
        df['Date'] = df['Date'].dt.strftime('%Y-%m-%d')
        
        df['Daily_Return'] = df['Close'].pct_change()
        df['MA_20'] = df['Close'].rolling(window=20).mean()
        df['MA_50'] = df['Close'].rolling(window=50).mean()
        df['Volatility_20'] = df['Daily_Return'].rolling(window=20).std() * np.sqrt(252)

        # Track daily returns for covariance matrix
        returns_series[ticker] = df.set_index('Date')['Daily_Return']

        latest_price = float(df['Close'].iloc[-1])
        start_price = float(df['Close'].iloc[0])
        total_return_pct = round(((latest_price - start_price) / start_price) * 100, 2)
        
        annualized_volatility = round(float(df['Daily_Return'].std() * np.sqrt(252) * 100), 2)
        avg_daily_return = df['Daily_Return'].mean()
        std_daily_return = df['Daily_Return'].std()
        
        sharpe_ratio = round(float(((avg_daily_return - rf_daily) / std_daily_return) * np.sqrt(252)), 2) if std_daily_return != 0 else 0.0

        daily_drift = float(avg_daily_return)
        daily_vol = float(std_daily_return)

        df['Signal'] = np.where(df['MA_20'] > df['MA_50'], 1, 0)
        df['Strategy_Return'] = df['Signal'].shift(1) * df['Daily_Return']
        strategy_cumulative = float((1 + df['Strategy_Return'].fillna(0)).cumprod().iloc[-1] - 1) * 100

        high_52w = float(df['High'].max())
        low_52w = float(df['Low'].min())

        raw_news = stock.news if hasattr(stock, 'news') and stock.news else []
        sentiment_data = analyze_news_items(raw_news)

        data[ticker] = {
            "info": {
                "name": ticker,
                "latest_price": round(latest_price, 2),
                "total_return_pct": total_return_pct,
                "annualized_volatility_pct": annualized_volatility,
                "daily_drift": round(daily_drift, 6),
                "daily_volatility": round(daily_vol, 6),
                "sharpe_ratio": sharpe_ratio,
                "strategy_return_pct": round(strategy_cumulative, 2),
                "high_52w": round(high_52w, 2),
                "low_52w": round(low_52w, 2),
                "sentiment_score": sentiment_data["score"],
                "sentiment_label": sentiment_data["label"],
                "sentiment_bullish_pct": sentiment_data["bullish_pct"],
                "sentiment_neutral_pct": sentiment_data["neutral_pct"],
                "sentiment_bearish_pct": sentiment_data["bearish_pct"]
            },
            "sentiment": sentiment_data,
            "history": df[['Date', 'Close', 'MA_20', 'MA_50', 'Daily_Return']].fillna(0).to_dict(orient='records')
        }

    # Calculate Markowitz Portfolio Theory
    if returns_series:
        returns_df = pd.DataFrame(returns_series).dropna()
        if not returns_df.empty:
            valid_tickers = [t for t in TICKERS if t in returns_df.columns]
            data["portfolio_optimization"] = compute_markowitz_portfolio(returns_df, valid_tickers)

    output_path = os.path.join(os.path.dirname(__file__), 'stock_data.json')
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print(f"Data successfully saved to {output_path}")

if __name__ == "__main__":
    analyze_stocks()
