To run:
# Backend (needs DATABASE_URL in .env)
cd backend
cp .env.example .env  # fill in values
uvicorn main:app --reload

# Frontend
cd frontend
npm run dev
Next steps per section 10:
1. Get real BMONI API key from mentor
2. Create sandbox users with real key
3. Run KYC activation
4. Request test tokens
5. Flip BMONI_MODE=live on Render