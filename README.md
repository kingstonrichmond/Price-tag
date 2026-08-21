# Price Tag — putting it on Netlify

Same method as the manager app: GitHub → Netlify. Drag-and-drop will **not** work here, because
drag-and-drop doesn't turn `netlify/functions/` into real serverless functions — and without the
function, the API key would have to sit in the page where anyone could read it.

## What's in here

```
index.html                  the page (all the styling lives here)
app.js                      the app, already compiled — this is what the page loads
app.tsx                     the source, for when you want to change something
netlify/functions/price.js  the proxy that holds your API key
netlify.toml                tells Netlify where things are
package.json                tells Netlify to use Node 18+
```

## Steps

1. **Make a new GitHub repo** — `price-tag`, private is fine. Upload every file in this folder,
   keeping the `netlify/functions/` folder structure intact.

2. **In Netlify:** Add new site → Import an existing project → GitHub → pick `price-tag`.
   Leave the build command blank. Publish directory: `.`  Functions directory: `netlify/functions`
   (the `netlify.toml` already says this, so the defaults should be right).

3. **Set the API key.** Site configuration → Environment variables → Add:

   | Key | Value |
   |---|---|
   | `ANTHROPIC_API_KEY` | your key from console.anthropic.com |
   | `APP_CODE` | *(optional)* a passcode, e.g. `valpizza` |

   Remember the env var gotcha from last time: the **Key** box only takes letters, numbers, and
   underscores. Anything odd in the key itself goes in the **Value** box.

4. **Redeploy** after setting env vars — Netlify doesn't pick them up on an existing build.
   Deploys → Trigger deploy → Clear cache and deploy site.

5. **Rename the site** to something Val will recognise: Site configuration → Change site name →
   e.g. `valpricetag` → she gets `valpricetag.netlify.app`.

6. **Put it on her phone.** Open the link in Safari (iPhone) or Chrome (Android) → Share →
   Add to Home Screen. It opens full-screen like an app, no browser bar.

## The `APP_CODE` question

Without it, anyone who finds the URL can run searches on your API key. It's a random-looking
`.netlify.app` address so it won't get found by accident, but it's worth setting. If you do set it,
the app asks Val for the code once and remembers it on that phone.

## Checking it worked

Open `https://yoursite.netlify.app/.netlify/functions/price` directly in a browser.
You should see a **405 POST only** message. If you get a 404, the function didn't deploy —
that means Netlify built from a drag-and-drop or the functions directory is set wrong.

## Changing the app later

`app.js` is compiled from `app.tsx`. If you edit the source, recompile before pushing:

```
tsc app.tsx --jsx react --target es2019 --outDir . --skipLibCheck --lib es2019,dom
node --check app.js
```

TypeScript will print a pile of type complaints — ignore those, it still writes `app.js`.
The `node --check` is the one that matters.

## Costs

Each price check is one API call with web search — a few cents. A hundred items a month is
lunch money. Netlify's free tier covers the hosting and the function calls.
