---
human_edit_tracking:
  enabled: true
  history: []
---
# Meals feedback Worker

Creates public GitHub issues from meals app feedback and proxies audio to the
managed transcription endpoint.

## Endpoints

- `GET /health` checks the Worker.
- `POST /feedback` creates an issue in `alejoacelas/meals`.
- `POST /transcribe` forwards multipart audio to Together AI.

## Deploy

From `app/`:

```bash
npx wrangler login
npx wrangler deploy --config sync/feedback/wrangler.toml
```

Then set runtime secrets:

```bash
set -a
. ~/.config/credentials/meals-feedback.env
. ~/.config/credentials/meals-feedback-transcription.env
set +a

printf '%s' "$GITHUB_APP_ID" | npx wrangler secret put GITHUB_APP_ID --config sync/feedback/wrangler.toml
printf '%s' "$GITHUB_APP_INSTALLATION_ID" | npx wrangler secret put GITHUB_APP_INSTALLATION_ID --config sync/feedback/wrangler.toml
npx wrangler secret put GITHUB_APP_PRIVATE_KEY --config sync/feedback/wrangler.toml < ~/.config/credentials/meals-feedback-github-app.private-key.pem
printf '%s' "$MEALS_FEEDBACK_OPENAI_API_KEY" | npx wrangler secret put MEALS_FEEDBACK_OPENAI_API_KEY --config sync/feedback/wrangler.toml
printf '%s' "$MEALS_FEEDBACK_TRANSCRIPTION_API_KEY" | npx wrangler secret put MEALS_FEEDBACK_TRANSCRIPTION_API_KEY --config sync/feedback/wrangler.toml
printf '%s' "$MEALS_FEEDBACK_TRANSCRIPTION_ENDPOINT" | npx wrangler secret put MEALS_FEEDBACK_TRANSCRIPTION_ENDPOINT --config sync/feedback/wrangler.toml
```

Finally paste the deployed Worker URL into `config.js` as `feedbackUrl`.
