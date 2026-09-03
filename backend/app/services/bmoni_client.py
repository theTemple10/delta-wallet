import uuid
import httpx
from typing import Optional, Dict, Any
from app.config import get_settings


class BMONIClient:
    def __init__(self):
        settings = get_settings()
        self.mode = settings.BMONI_MODE
        self.api_key = settings.BMONI_API_KEY
        self.base_url = settings.BMONI_BASE_URL

    async def _request(self, method: str, path: str, data: Optional[Dict] = None) -> Dict[str, Any]:
        if self.mode == "mock":
            return await self._mock_request(method, path, data)
        return await self._live_request(method, path, data)

    async def _live_request(self, method: str, path: str, data: Optional[Dict] = None) -> Dict[str, Any]:
        async with httpx.AsyncClient() as client:
            headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
            url = f"{self.base_url}{path}"
            response = await client.request(method, url, json=data, headers=headers)
            response.raise_for_status()
            return response.json()

    async def _mock_request(self, method: str, path: str, data: Optional[Dict] = None) -> Dict[str, Any]:
        await asyncio.sleep(0.1)

        if "/users" in path and method == "POST" and "/smart-wallets" not in path:
            user_id = str(uuid.uuid4())
            return {
                "data": {
                    "user": {
                        "id": user_id,
                        "firstName": data.get("firstName"),
                        "lastName": data.get("lastName"),
                        "email": data.get("email"),
                        "phoneNumber": data.get("phoneNumber"),
                        "bvn": data.get("bvn"),
                        "status": "active",
                        "smartWallets": [{"id": str(uuid.uuid4()), "status": "active"}]
                    }
                }
            }

        if "/smart-wallets/" in path and "/proposals" in path and method == "POST":
            proposal_id = str(uuid.uuid4())
            proposal_type = data.get("proposal", {}).get("type", "SWAP")
            return {
                "data": {
                    "proposal": {
                        "id": proposal_id,
                        "status": "PENDING_APPROVALS",
                        "type": proposal_type,
                        "amount": data.get("proposal", {}).get("amount") or data.get("proposal", {}).get("fromAmount"),
                        "currency": data.get("proposal", {}).get("currency") or data.get("proposal", {}).get("toStablecoin")
                    }
                }
            }

        if "/approve" in path and method == "POST":
            return {"data": {"status": "approved"}}

        if "/sign-payload" in path and method == "GET":
            return {"data": {"hashToSign": f"0x{uuid.uuid4().hex}"}}

        if "/sign" in path and method == "POST":
            return {"data": {"status": "PENDING_SIGNATURES", "txHash": f"0x{uuid.uuid4().hex}"}}

        if "/proposals/" in path and method == "GET" and "sign" not in path:
            return {"data": {"proposal": {"id": path.split("/")[-1], "status": "COMPLETED"}}}

        if "/cards" in path and method == "POST":
            card_id = str(uuid.uuid4())
            proposal_id = str(uuid.uuid4())
            return {
                "data": {
                    "card": {"id": card_id, "status": "active"},
                    "proposalId": proposal_id,
                    "signPayload": {"hashToSign": f"0x{uuid.uuid4().hex}"}
                }
            }

        if "/set-limit" in path and method == "PUT":
            return {"data": {"status": "limits_updated"}}

        if "/kyc" in path and "activate" in path and method == "POST":
            return {"data": {"status": "verified"}}

        if "/bvn-lookup" in path or "/nin-lookup" in path:
            return {"data": {"match": True, "name": "Bunch Dillon"}}

        return {"data": {}}

    async def create_user(self, first_name: str, last_name: str, email: str, phone: str, bvn: str) -> Dict:
        return await self._request("POST", "/v1/users", {
            "firstName": first_name, "lastName": last_name,
            "email": email, "phoneNumber": phone, "bvn": bvn
        })

    async def create_proposal(self, user_id: str, wallet_id: str, proposal_data: Dict) -> Dict:
        return await self._request("POST", f"/v1/users/{user_id}/smart-wallets/{wallet_id}/proposals", {"proposal": proposal_data})

    async def approve_proposal(self, user_id: str, proposal_id: str) -> Dict:
        return await self._request("POST", f"/v1/users/{user_id}/smart-wallets/proposals/{proposal_id}/approve")

    async def get_sign_payload(self, user_id: str, proposal_id: str) -> Dict:
        return await self._request("GET", f"/v1/users/{user_id}/smart-wallets/proposals/{proposal_id}/sign-payload")

    async def sign_proposal(self, user_id: str, proposal_id: str, signature: str) -> Dict:
        return await self._request("POST", f"/v1/users/{user_id}/smart-wallets/proposals/{proposal_id}/sign", {"signature": signature})

    async def get_proposal_status(self, user_id: str, proposal_id: str) -> Dict:
        return await self._request("GET", f"/v1/users/{user_id}/smart-wallets/proposals/{proposal_id}")

    async def issue_card(self, user_id: str, card_data: Dict) -> Dict:
        return await self._request("POST", f"/v1/users/{user_id}/cards", card_data)

    async def set_card_limit(self, user_id: str, card_id: str, limits: Dict) -> Dict:
        return await self._request("PUT", f"/v1/users/{user_id}/cards/{card_id}/set-limit", limits)

    async def activate_kyc(self, user_id: str, personal_info: Dict) -> Dict:
        return await self._request("POST", f"/v1/users/{user_id}/kyc/activate", {"personalInfo": personal_info})


import asyncio

bmoni_client = BMONIClient()
