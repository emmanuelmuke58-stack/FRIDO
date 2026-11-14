# FRIDO AI deployment

The AI features use a separate Express API because GitHub Pages only hosts static frontend files.

## Features included
- Career Assistant (public)
- Smart Job Matching (signed-in users; compares the submitted profile with active FRIDO job listings)
- CV Assistant (signed-in users)
- Job Description Generator (authorized admin/editor roles)
- Admin AI Assistant (authorized admin/editor roles)

## 1. Deploy the API on Render
1. In Render, choose **New > Blueprint** and connect this repository.
2. Select the `feature/openai-ai-suite` branch for initial review, or deploy the merged default branch after the pull request is approved.
3. Render reads `render.yaml` and creates the `frido-api` web service.
4. In the Render service environment, set `OPENAI_API_KEY` to the secret created in OpenAI Platform. Never commit the key to GitHub.
5. Confirm `/api/health` returns JSON with status `ok`.

## 2. Connect GitHub Pages to the API
After Render creates the service, copy its actual service origin (for example `https://frido-api.onrender.com`, without a trailing slash). In GitHub, open **Settings → Secrets and variables → Actions → Variables → New repository variable** and create `VITE_API_BASE_URL` with that origin as its value. The Pages workflow reads this variable during the Vite build. Re-run the Pages workflow after setting it.

The API already allows the FRIDO GitHub Pages origin. If the site moves to another domain, update `FRONTEND_ORIGIN` on Render.

## 3. Open the AI hub
After deployment, visit `https://emmanuelmuke58-stack.github.io/FRIDO/ai`.

## Security and behavior
- The OpenAI secret is read only by the backend from `OPENAI_API_KEY`.
- The browser never receives the OpenAI key.
- Career Assistant is public and rate-limited by IP.
- Job matching and CV review require a Firebase ID token.
- Job Description Generator and Admin Assistant additionally check the user's Firestore role and active status.
- Do not paste national ID numbers, passwords, or confidential personal information into AI tools.
- AI output is advisory. Verify vacancies, qualifications, deadlines, and employer details against original sources.

## Configuration
- `OPENAI_MODEL`: defaults to `gpt-4.1-mini`.
- `FRONTEND_ORIGIN`: comma-separated allowed frontend origins.
- `VITE_API_BASE_URL`: public Render API origin used at Vite build time.
