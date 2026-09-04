import groq
import json
from typing import List, Dict
from app.config import get_settings


def get_groq_client():
    settings = get_settings()
    return groq.Groq(api_key=settings.GROQ_API_KEY)


async def generate_split_proposal(amount: float, currency: str, channels: List[Dict]) -> List[Dict]:
    try:
        client = get_groq_client()
        channels_text = "\n".join([
            f"- {c['label']} ({c['type']}, target: {c.get('target_currency', 'CNGN')})"
            for c in channels
        ])

        response = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{
                "role": "user",
                "content": f"""You are a financial advisor for a Nigerian tech worker earning {currency}.
Split {amount} {currency} across these spending channels. Use realistic Nigerian amounts:
- Family support: 15-30% of income
- Rent/housing: 20-35% of income
- Savings: 10-20% of income
- Discretionary: remainder

Channels:
{channels_text}

Return a JSON object with "splits" key containing array of objects with: channel_id, amount (number), one_line_reason (short, concrete like "rent due in 8 days").
Return ONLY valid JSON. Do not exceed the total amount."""
            }],
            response_format={"type": "json_object"}
        )
        result = json.loads(response.choices[0].message.content)
        return result.get("splits", result if isinstance(result, list) else [])
    except Exception:
        # Nigeria-realistic default percentages
        default_pcts = [0.25, 0.30, 0.15, 0.30]
        splits = []
        for i, c in enumerate(channels):
            pct = default_pcts[i] if i < len(default_pcts) else (1.0 / len(channels))
            splits.append({
                "channel_id": str(c["id"]),
                "amount": round(amount * pct, 2),
                "one_line_reason": f"Priority {i+1} allocation ({int(pct*100)}%)"
            })
        return splits


async def generate_digest(event, proposals) -> str:
    try:
        client = get_groq_client()
        proposals_text = "\n".join([f"- {p.type}: {p.amount} ({p.status})" for p in proposals])

        response = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{
                "role": "user",
                "content": f"""Summarize this inflow event in 2-3 warm, factual sentences. No predictions.
Amount: {event.amount} {event.currency}
Proposals:
{proposals_text}"""
            }]
        )
        return response.choices[0].message.content
    except Exception:
        return f"Received {event.amount} {event.currency}. {len(proposals)} proposals processed."
