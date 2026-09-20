import yfinance as yf
import pandas as pd
import numpy as np
import json
import os
from sentiment import analyze_news_items

# Define US Tech Stock Tickers
TICKERS = ["AAPL", "NVDA", "MSFT", "TSLA", "GOOGL", "AMZN"]
PERIOD = "1y"

def analyze_stocks():
    print("Fetching US Tech Stock data...")
    data = {}
    
    # Risk-free rate assumption (annualized 4.5% = 0.045 / 252 daily)
    rf_daily = 0.045 / 252

    for ticker in TICKERS:
        print(f"Processing {ticker}...")
        stock = yf.Ticker(ticker)
        df = stock.history(period=PERIOD)

        if df.empty:
            continue

        # Clean index & columns
        df.reset_index(inplace=True)
        df['Date'] = df['Date'].dt.strftime('%Y-%m-%d')
        
        # Calculate Technical Indicators & Math Metrics
        df['Daily_Return'] = df['Close'].pct_change()
        df['MA_20'] = df['Close'].rolling(window=20).mean()
        df['MA_50'] = df['Close'].rolling(window=50).mean()
        df['Volatility_20'] = df['Daily_Return'].rolling(window=20).std() * np.sqrt(252)

        # Summary Financial Metrics
        latest_price = float(df['Close'].iloc[-1])
        start_price = float(df['Close'].iloc[0])
        total_return_pct = round(((latest_price - start_price) / start_price) * 100, 2)
        
        annualized_volatility = round(float(df['Daily_Return'].std() * np.sqrt(252) * 100), 2)
        avg_daily_return = df['Daily_Return'].mean()
        std_daily_return = df['Daily_Return'].std()
        
        # Sharpe Ratio = (Mean Return - Risk Free Rate) / Volatility
        sharpe_ratio = round(float(((avg_daily_return - rf_daily) / std_daily_return) * np.sqrt(252)), 2) if std_daily_return != 0 else 0.0

        # Simple Trading Strategy Backtest: 20-MA crossing above 50-MA (Golden Cross)
        df['Signal'] = np.where(df['MA_20'] > df['MA_50'], 1, 0)
        df['Strategy_Return'] = df['Signal'].shift(1) * df['Daily_Return']
        strategy_cumulative = float((1 + df['Strategy_Return'].fillna(0)).cumprod().iloc[-1] - 1) * 100

        # High & Low 52-week
        high_52w = float(df['High'].max())
        low_52w = float(df['Low'].min())

        # Fetch News & Perform NLP Sentiment Analysis
        raw_news = stock.news if hasattr(stock, 'news') and stock.news else []
        sentiment_data = analyze_news_items(raw_news)

        data[ticker] = {
            "info": {
                "name": ticker,
                "latest_price": round(latest_price, 2),
                "total_return_pct": total_return_pct,
                "annualized_volatility_pct": annualized_volatility,
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

    output_path = os.path.join(os.path.dirname(__file__), 'stock_data.json')
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print(f"Data successfully saved to {output_path}")

if __name__ == "__main__":
    analyze_stocks()
