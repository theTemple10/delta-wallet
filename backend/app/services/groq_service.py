import groq
from typing import List, Dict
from app.config import get_settings


def get_groq_client():
    settings = get_settings()
    return groq.Groq(api_key=settings.GROQ_API_KEY)


async def generate_split_proposal(amount: float, currency: str, channels: List[Dict]) -> List[Dict]:
    try:
        client = get_groq_client()
        channels_text = "\n".join([f"- {c['label']} ({c['type']}, {c['target_currency']})" for c in channels])

        response = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{
                "role": "user",
                "content": f"""Split {amount} {currency} across these channels. Return JSON array with channel_id, amount, one_line_reason.
Channels:
{channels_text}
Keep reasons short and concrete (e.g. "rent is due in 6 days"). Return ONLY valid JSON."""
            }],
            response_format={"type": "json_object"}
        )
        import json
        return json.loads(response.choices[0].message.content).get("splits", [])
    except Exception:
        return [{"channel_id": str(c["id"]), "amount": amount / len(channels), "one_line_reason": "Default split"} for c in channels]


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
