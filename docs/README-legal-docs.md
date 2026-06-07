# Hosting legal documents (Privacy Policy + Terms)

Google Play and the App Store require **public URLs** for your Privacy Policy. Terms and Conditions are strongly recommended at signup and in the app.

## 1. Customize the documents

Edit both HTML files in `docs/`:

| File | Purpose |
|------|---------|
| `privacy-policy.html` | Privacy Policy |
| `terms-and-conditions.html` | Terms and Conditions |

Replace `YOUR_EMAIL@example.com` with your real contact email in **both** files. Update the "Last updated" dates when you change the text.

## 2. Publish with GitHub Pages (free)

1. Push the `docs/` folder to GitHub.
2. **Settings** → **Pages** → Source: **Deploy from a branch**.
3. Branch: `main`, folder: **`/docs`**.
4. After deploy, your URLs are:

   - Privacy: `https://<github-username>.github.io/<repo-name>/privacy-policy.html`
   - Terms: `https://<github-username>.github.io/<repo-name>/terms-and-conditions.html`

   Example (configured in the app today):

   - `https://dhanushrahul.github.io/rack-n-roll/privacy-policy.html`
   - `https://dhanushrahul.github.io/rack-n-roll/terms-and-conditions.html`

5. Paste the **Privacy Policy** URL into Play Console / App Store Connect.

## 3. App integration

URLs are centralized in `frontend/src/config/legalUrls.js`. Update `LEGAL_DOCS_BASE_URL` if your hosted path changes.

Legal links appear in:

- **Landing** — footer links
- **Sign up** — required consent checkbox + footer links
- **Sign in** — footer links
- **Profile** — Legal section

## 4. Play Console alignment

- **Privacy policy URL** → hosted `privacy-policy.html`
- **Data safety** → match what the privacy policy states
- Account creation collects name, email, password
