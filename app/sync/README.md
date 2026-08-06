# Kitchen sync (optional)

The app works without this — saves just stay on each device. Deploy this one
file to make a **kitchen name follow you across phone and computer**. It's a tiny
public key/value store on Cloudflare Workers (free tier is plenty).

## What it is
- `GET  /<name>` → that kitchen's saved data (`{}` if none)
- `PUT  /<name>` → overwrite it (JSON body)

Public and unauthenticated **on purpose** — anyone who knows a kitchen name can
read and overwrite it, which is the app's sharing model. The endpoint URL is not
a secret; store nothing private here.

## Deploy (≈5 minutes, needs a free Cloudflare account)
From this folder:

```bash
npx wrangler login                              # opens the browser once
npx wrangler kv namespace create KITCHENS       # prints an id=...
# paste that id into wrangler.toml (replace REPLACE_WITH_YOUR_KV_NAMESPACE_ID)
npx wrangler deploy                             # prints https://meals-sync.<you>.workers.dev
```

Then put that URL in `../config.js`:

```js
window.MEALS_CONFIG = { syncUrl: "https://meals-sync.<you>.workers.dev" };
```

Rebuild isn't needed — `config.js` is read at load. Reload the app and the same
kitchen name will now carry your basket and saved recipes everywhere.

## Notes
- A kitchen payload is capped at 100 KB (a basket plus a list of saved recipes).
- Want it private later? Add a shared secret header check in `worker.js` and send
  it from the app — but that breaks the "type a name anywhere" simplicity.
- Any equivalent KV works (Deno Deploy, Vercel KV, a 20-line Express app). The
  app only needs `GET`/`PUT` at `<syncUrl>/<name>` with permissive CORS.
