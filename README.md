# Ray-Ban Video

A dependency-free video library player designed for the Meta Ray-Ban Display's
600 × 600 additive display. It loads folders and playable files from the configured
movie-service API and streams media from the configured media base URL.

## Test in a browser

Python 3:

```powershell
python -m http.server 8080
```

Then open <http://localhost:8080> in Edge or Chrome. Use the arrow keys to move
focus and Enter to activate controls. In DevTools, set the viewport to 600 × 600
and resize around that size to check responsive scaling.

The default API and media URLs are already configured. Open **Settings** to change
the listing endpoint, media base URL, password, or automatic next-video behavior.
Settings are stored only in the browser's `localStorage`.

## Test for Meta Ray-Ban Display

1. Install the Meta Ray-Ban Display Simulator Chrome extension.
2. Open the locally served app in Chrome and activate the extension.
3. Check the 600 × 600 additive preview, arrow/Enter navigation, focus visibility,
   and the simulator's quality checklist.
4. Publish these static files to a publicly accessible HTTPS host such as GitHub
   Pages, Netlify, Cloudflare Pages, or Vercel.
5. In the Meta AI app, enable Developer Mode by opening **Settings > App Info**,
   tapping the app version five times, and selecting **Enable**.
6. Open **App Settings > Apps > Web Apps > Connect Web App**, enter the HTTPS URL,
   and save it. Alternatively, use **View on Glasses QR** in the simulator.

Meta's current minimums are glasses software v125+ and Meta AI app v272+. Desktop
and simulator testing do not replace final testing on the glasses.
