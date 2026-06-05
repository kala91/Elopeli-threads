# Elopeli Threads

Elopeli Threads / Säikeet is an async multiplayer prototype for digital-assisted improvisation. A facilitator creates a scenario, players join from separate devices, and each character receives private dramaturgical prompts.

This archival branch has been adapted from a Gemini AI Studio export to use a local Ollama server. The client scans available Ollama models from the server and asks the facilitator to choose one before creating a game.

## Run Locally

Prerequisites:

- Node.js
- Ollama running locally or on a reachable LAN host
- At least one pulled Ollama model

1. Install dependencies:
   `npm install`
2. Optional: set `OLLAMA_BASE_URL` in `.env.local`.
   Default: `http://localhost:11434`
3. Start the app:
   `npm run dev`

The model selector calls `/api/models`, which proxies Ollama `/api/tags`. All later scenario, character, prompt, and state-update generations use the model selected when the game was created.

## Notes

Ollama responses are parsed as JSON and the server asks the model to return only the expected object shape. Smaller models may still need prompt or temperature tuning if they produce invalid JSON.
