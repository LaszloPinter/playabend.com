# playabend.com

Website for [ABEND](https://playabend.com) — a roguelite puzzle-combat game for iOS.

## Stack

Pure HTML + CSS + vanilla JS. No frameworks, no build tools.

- **IBM 3270** — terminal font (self-hosted WOFF2)
- **IBM Plex Sans** — body font (Google Fonts)
- **Canvas** — perspective grid background animation

## Hosting

GitHub Pages with custom domain (`playabend.com`).

## Setup

1. Clone this repo
2. Download [IBM 3270 font](https://github.com/rbanffy/3270font) and convert to WOFF2, place in `fonts/3270-Regular.woff2`
3. Download [App Store badge](https://developer.apple.com/app-store/marketing/guidelines/) SVG, place in `images/app-store-badge.svg`
4. Add real screenshots to `images/screenshot-1.png`, `screenshot-2.png`, `screenshot-3.png`
5. Add app icon to `images/icon-512.png`
6. Create social preview image (1200x630) at `images/og-image.png`
7. Push to GitHub, enable Pages in repo settings

## DNS

At your registrar, add these records:

### GitHub Pages (website)
```
A     @    185.199.108.153
A     @    185.199.109.153
A     @    185.199.110.153
A     @    185.199.111.153
CNAME www  YOUR_USERNAME.github.io
```

### Zoho Mail (email)
```
MX    @    mx.zoho.eu       (priority 10)
MX    @    mx2.zoho.eu      (priority 20)
MX    @    mx3.zoho.eu      (priority 50)
TXT   @    v=spf1 include:zoho.eu ~all
TXT   _dmarc  v=DMARC1; p=none; rua=mailto:hello@playabend.com
```

## Local Preview

Open `index.html` in a browser, or serve locally:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## TODO

- [ ] Download and add IBM 3270 WOFF2 font
- [ ] Download and add App Store badge SVG
- [ ] Replace placeholder screenshots with real ones
- [ ] Add app icon (icon-512.png)
- [ ] Create og-image.png (1200x630)
- [ ] Set up Zoho Mail and verify DNS
- [ ] Enable GitHub Pages + custom domain
- [ ] Uncomment Smart App Banner meta tag with real App ID
- [ ] Replace trailer placeholder with YouTube embed
- [ ] Update social media links with real profile URLs
