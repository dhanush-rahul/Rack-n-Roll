# Hosting the privacy policy for Google Play

Google Play requires a **public URL** to your privacy policy (not a file in the repo alone).

See also **`README-legal-docs.md`** for Terms and Conditions hosting and in-app link locations.

## 1. Customize the policy

Edit `docs/privacy-policy.html` and `docs/terms-and-conditions.html`:

- Contact email: `racknrollemail@gmail.com`
- Adjust the "Last updated" date if you change the text.

## 2. Publish with GitHub Pages (free)

1. Push `docs/privacy-policy.html` to GitHub.
2. On GitHub: **Settings** → **Pages**.
3. **Build and deployment** → Source: **Deploy from a branch**.
4. Branch: `main`, folder: **`/docs`**.
5. Save. After a minute, your URL is:

   `https://<github-username>.github.io/<repo-name>/privacy-policy.html`

   Example: `https://dhanush-rahul.github.io/Rack-n-Roll/privacy-policy.html`

6. Paste that URL into **Play Console** → **App content** → **Privacy policy**.

## 3. Align Play Console "Data safety"

Declare what you actually collect (matches the policy):

- Email address, name, user IDs
- App activity (tournament registrations, scores)
- Optional: device or other IDs only if you add analytics later

Account creation → **Yes**. Data encrypted in transit → **Yes** (HTTPS to your API).

## 4. Other hosting options

- Notion public page
- Google Sites
- Any static host (Render static site, etc.)

The URL must open in a browser without login.
