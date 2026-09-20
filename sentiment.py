"""
Financial Sentiment Analysis Engine (Quantitative NLP)
Implements domain-specific financial sentiment scoring modeled on
the Loughran-McDonald financial dictionary and VADER sentiment rules.
"""

import re
from datetime import datetime

# Domain-specific financial dictionary with intensity weights
FINANCIAL_LEXICON = {
    # Strong Bullish (+3)
    "breakthrough": 3.0, "soar": 3.0, "soars": 3.0, "soaring": 3.0, "surge": 3.0,
    "surges": 3.0, "surging": 3.0, "rally": 3.0, "rallies": 3.0, "record": 2.5,
    "outperform": 3.0, "outperformed": 3.0, "outperforming": 3.0, "skyrocket": 3.5,
    "jackpot": 3.0, "blockbuster": 3.0,

    # Moderate Bullish (+2)
    "gain": 2.0, "gains": 2.0, "gaining": 2.0, "gained": 2.0, "bull": 2.0,
    "bullish": 2.5, "upgrade": 2.5, "upgrades": 2.5, "upgraded": 2.5, "growth": 2.0,
    "profit": 2.0, "profitable": 2.0, "profitability": 2.0, "boost": 2.0, "boosts": 2.0,
    "beat": 2.5, "beats": 2.5, "dividend": 1.8, "upside": 2.0, "expand": 1.8,
    "expansion": 1.8, "innovate": 2.0, "innovation": 2.0, "momentum": 2.0,
    "rebound": 2.0, "rebounds": 2.0, "high": 1.5, "highs": 1.5, "strong": 1.8,
    "lead": 1.5, "leader": 2.0, "partnership": 1.8, "milestone": 2.0,

    # Mild Bullish (+1)
    "opportunity": 1.2, "promising": 1.4, "efficient": 1.2, "efficiency": 1.2,
    "optimism": 1.5, "optimistic": 1.5, "positive": 1.5, "stable": 1.0,
    "confidence": 1.4, "confident": 1.4, "buy": 1.8, "win": 1.8, "wins": 1.8,

    # Strong Bearish (-3)
    "plunge": -3.0, "plunges": -3.0, "plunging": -3.0, "crash": -3.5, "crashes": -3.5,
    "collapse": -3.5, "collapses": -3.5, "fraud": -3.5, "lawsuit": -2.8, "sued": -2.8,
    "investigation": -2.5, "antitrust": -2.5, "probe": -2.5, "scandal": -3.5,
    "default": -3.5, "bankruptcy": -4.0, "plummet": -3.5, "plummeting": -3.5,

    # Moderate Bearish (-2)
    "slump": -2.2, "slumps": -2.2, "drop": -2.0, "drops": -2.0, "dropping": -2.0,
    "decline": -2.0, "declines": -2.0, "declining": -2.0, "declined": -2.0,
    "bear": -2.0, "bearish": -2.5, "downgrade": -2.5, "downgrades": -2.5,
    "downgraded": -2.5, "loss": -2.2, "losses": -2.2, "miss": -2.2, "misses": -2.2,
    "cut": -1.8, "cuts": -1.8, "cutting": -1.8, "layoff": -2.2, "layoffs": -2.2,
    "warning": -2.0, "warns": -2.0, "struggle": -2.0, "struggles": -2.0,
    "struggling": -2.0, "headwind": -2.0, "headwinds": -2.0, "debt": -1.5,
    "risk": -1.5, "risks": -1.5, "weak": -1.8, "weakness": -1.8, "pressure": -1.5,

    # Mild Bearish (-1)
    "concern": -1.2, "concerns": -1.2, "uncertainty": -1.4, "volatile": -1.2,
    "volatility": -1.0, "delay": -1.2, "delays": -1.2, "fall": -1.5, "falls": -1.5,
    "curb": -1.5, "curbs": -1.5, "sluggish": -1.5, "pessimism": -1.5
}

# Negations invert the sign of the following sentiment word
NEGATION_WORDS = {
    "not", "no", "never", "hardly", "barely", "scarcely",
    "fails", "failed", "failing", "neither", "none", "without", "prevent"
}

# Intensifiers amplify polarity
INTENSIFIERS = {
    "very": 1.5, "extremely": 2.0, "substantially": 1.5, "sharply": 1.7,
    "steeply": 1.7, "massively": 2.0, "hugely": 1.8, "significantly": 1.6,
    "heavily": 1.5, "strongly": 1.6
}

def clean_and_tokenize(text: str) -> list[str]:
    """Lowercase text and extract word tokens."""
    if not text:
        return []
    text = text.lower()
    return re.findall(r'\b[a-z]{2,}\b', text)

def score_text(text: str) -> float:
    """
    Computes a normalized polarity score in range [-1.0, 1.0].
    Takes into account domain financial vocabulary, intensifiers, and 3-word negation context.
    """
    tokens = clean_and_tokenize(text)
    if not tokens:
        return 0.0

    scores = []
    
    for i, token in enumerate(tokens):
        if token in FINANCIAL_LEXICON:
            base_score = FINANCIAL_LEXICON[token]
            
            # Check for intensifier in previous 2 tokens
            multiplier = 1.0
            for offset in [1, 2]:
                if i - offset >= 0:
                    prev_token = tokens[i - offset]
                    if prev_token in INTENSIFIERS:
                        multiplier *= INTENSIFIERS[prev_token]
            
            # Check for negation in previous 3 tokens
            is_negated = False
            for offset in [1, 2, 3]:
                if i - offset >= 0:
                    prev_token = tokens[i - offset]
                    if prev_token in NEGATION_WORDS:
                        is_negated = True
                        break
            
            final_token_score = base_score * multiplier
            if is_negated:
                # Invert and slightly dampen negated sentiment
                final_token_score = -0.8 * final_token_score
                
            scores.append(final_token_score)

    if not scores:
        return 0.0

    # Normalization formula standard in sentiment analysis
    sum_scores = sum(scores)
    # Range normalizer: score / sqrt(score^2 + alpha)
    normalized = sum_scores / ((sum_scores ** 2 + 15) ** 0.5)
    return round(float(normalized), 2)

def classify_sentiment(score: float) -> str:
    """Classifies a polarity score into Bullish, Bearish, or Neutral."""
    if score >= 0.12:
        return "Bullish"
    elif score <= -0.12:
        return "Bearish"
    return "Neutral"

def analyze_news_items(raw_news: list) -> dict:
    """
    Parses yfinance news array and computes individual and aggregate sentiment metrics.
    """
    articles = []
    scores = []
    
    for item in raw_news:
        # Handles both yfinance schema variants (new content dict vs legacy flat dict)
        content = item.get("content", {}) if isinstance(item.get("content"), dict) else {}
        
        title = content.get("title") or item.get("title") or ""
        if not title:
            continue
            
        summary = content.get("summary") or item.get("summary") or ""
        
        # Provider / Publisher
        provider = content.get("provider", {})
        publisher = (
            provider.get("displayName") 
            if isinstance(provider, dict) else item.get("publisher") or "Market News"
        )
        
        # URL link
        canonical = content.get("canonicalUrl", {})
        url = (
            canonical.get("url") 
            if isinstance(canonical, dict) else item.get("link") or "#"
        )
        
        # Publish Date
        pub_date = content.get("pubDate") or item.get("providerPublishTime")
        date_str = "Recent"
        if isinstance(pub_date, str) and len(pub_date) >= 10:
            date_str = pub_date[:10]
        elif isinstance(pub_date, (int, float)):
            try:
                date_str = datetime.fromtimestamp(pub_date).strftime("%Y-%m-%d")
            except Exception:
                date_str = "Recent"

        # Combine title and summary for richer NLP context
        combined_text = f"{title}. {summary}"
        score = score_text(combined_text)
        label = classify_sentiment(score)
        
        scores.append(score)
        articles.append({
            "title": title,
            "summary": summary[:140] + "..." if len(summary) > 140 else summary,
            "publisher": publisher,
            "date": date_str,
            "url": url,
            "score": score,
            "label": label
        })

    # Aggregate Sentiment Calculation
    if scores:
        avg_score = round(sum(scores) / len(scores), 2)
        bullish_count = sum(1 for s in scores if s >= 0.12)
        bearish_count = sum(1 for s in scores if s <= -0.12)
        neutral_count = len(scores) - bullish_count - bearish_count
        
        bullish_pct = round((bullish_count / len(scores)) * 100)
        bearish_pct = round((bearish_count / len(scores)) * 100)
        neutral_pct = 100 - bullish_pct - bearish_pct
        
        overall_label = classify_sentiment(avg_score)
    else:
        avg_score = 0.0
        bullish_pct, neutral_pct, bearish_pct = 0, 100, 0
        overall_label = "Neutral"

    return {
        "score": avg_score,
        "label": overall_label,
        "bullish_pct": bullish_pct,
        "neutral_pct": neutral_pct,
        "bearish_pct": bearish_pct,
        "sample_size": len(articles),
        "articles": articles[:6] # Top 6 most relevant
    }
