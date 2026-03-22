Act as a Senior Full-stack Engineer. Build a Next.js 14 (App Router) web application named "황감지 (Hwang-Gam-Ji)". 

### Project Goal:
A visibility index service for Hwangnyeongsan, Busan, that calculates a "Hwang-Gam Score" based on real-time weather and dust data, focusing heavily on 'Visibility (시정)'.

### Tech Stack:
- Framework: Next.js 14+, TypeScript, Tailwind CSS
- Animation: Framer Motion (for score counting and jackpot effects)
- Icons: Lucide React
- Deployment: Vercel (Optimized for Serverless Functions)

### Core Logic (Scoring & Jackpot):
Create a utility function `calculateHwangGamScore` in `utils/scoring.ts`:
1. Normal Mode (0-50km):
   - Score = (Visibility_km / 50) * 100. (Visibility has 70% weight, Dust 20%, Clouds 10%).
2. Jackpot Mode (Extreme Visibility):
   - Level 1: If Visibility >= 60km and < 70km, Force Score to **1,000**.
   - Level 2: If Visibility >= 70km, Force Score to **10,000**.
3. Logic should return `{ score, label, description, isJackpot, jackpotLevel }`.

### Data Fetching (API Routes):
Create an API route `/api/weather` that fetches:
1. KMA ASOS Data: Station 159 (Busan) for 'Visibility (vs)'.
2. AirKorea API: Dust levels (PM10, PM2.5) for Busan Nam-gu/Suyeong-gu.
3. Sunrise/Sunset API: For golden hour calculations.

### UI/UX Requirements:
- Mobile-first, sleek "Samsung Weather" inspired dashboard.
- Main Display: Large animated score (using Framer Motion `animate` from 0 to target).
- Jackpot Effects: 
  - If 1,000 pts: Golden theme, glowing text, "Jackpot!" badge.
  - If 10,000 pts: Rainbow gradient background, particle confetti (framer-motion), "God-Tier Visibility" status.
- Visibility Card: Show distance in 'km' prominently.
- Sunset Countdown: Display time remaining until sunset.

### Instructions:
1. Start by setting up the project structure.
2. Create the scoring utility first.
3. Build the main dashboard page (`app/page.tsx`) with a mock-up state before connecting real APIs.
4. Apply a responsive, dark-mode friendly design with Busan-inspired aesthetics.

Please generate the initial folder structure and the code for `utils/scoring.ts` and the main `page.tsx` now.