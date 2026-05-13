# Svenska — speed-drill site

Static HTML for drilling Swedish — designed for high-frequency, low-vocabulary muscle-memory practice during a one-on-one lesson, plus solo flashcard practice.

Deployed at **<https://playabend.com/svenska/>**.

Four pages:

- **`index.html`** — *Landing*. Session creation form (passcode → starts a shared session and shows the student link in a modal that auto-copies to the clipboard). Has nav buttons to *Database* and *Guide*.
- **`database.html`** — ~375 phrases across 21 categories (prepositions, possessives, question words, time expressions, modal verbs, common verbs, situational phrases). Click-to-reveal English + Hungarian. Search + category filter.
- **`dialog.html`** — ~4,600 unique short 3–6 line dialogs, generated from ~40 templates × typed vocabulary pools. Two-speaker layout with per-bubble reveal. Joined via `?session=ID&role=teacher|student` URL (sessions are created on the landing page). Falls back to single-user solo practice if no session is in the URL.
- **`teacher-guide.html`** — short documentation for the teacher on what the system is, what the student is drilling, and how to drive a shared session.

No build step. Edit the HTML files directly and push to GitHub Pages.

---

## Architecture (`dialog.html`)

Three pieces.

### 1. POOLS

Typed buckets of pre-inflected vocabulary. Every entry already carries every grammatical form a template might need: definite/indefinite forms, gender, prepositional phrases, possessive matched to gender, anaphoric pronoun, demonstrative+adjective+definite phrases, etc.

**The cardinal rule: never compose Swedish from parts at runtime.** Pre-bake the full inflected form in the pool. The engine picks pieces; it does not inflect.

This is why the `demonstrative-grammar` template can produce both
- "Är **den** gröna bilen **min**? … Är **den** ny? Ganska **ny**. Vi har köpt **den**…" (en-word agreement) and
- "Är **det** vita huset **mitt**? … Är **det** nytt? Ganska **nytt**. Vi har köpt **det**…" (ett-word agreement)

…without the engine knowing anything about Swedish gender — both forms exist verbatim in the pool entries.

### 2. TEMPLATES

Dialog skeletons. Each declares:
- `id` — unique string
- `tags` — categories drilled (informational, shown in UI)
- `speakers` — array of `"A"` or `"B"`, one per line
- `slots` — `{ slotName: poolName }` mapping
- `en` and `sv` — parallel line arrays, with placeholders like `{slotName.fieldName}` or `{slotName.fieldName|cap}` (the `|cap` modifier capitalizes for sentence starts)
- `sameCategory` *(optional)* — array of slot names that must share a `category` value. Used when two slots draw from the same pool and shouldn't be wildly different (e.g. `c` and `c2` in `demonstrative-grammar` are both colored things, but should always be the same kind of thing — bag vs. another bag, not bag vs. house).
- `where` *(optional)* — `{ slotName: { field: value, … } }`. Restricts a slot to pool entries whose fields match. Used to filter `place` slots to only `is_business: true` entries in `is-place-open`, for example.

If two slots reference the same pool, the engine picks **distinct entries** for each.

### 3. Engine

- Seeded PRNG (mulberry32) — each dialog has a stable seed so it can be replayed
- `pickSlots` fills slots, picking distinct entries within shared pools, respecting `sameCategory` and `where`
- `render` substitutes `{slot.field}` and applies `|cap`
- Per-line two-side reveal state: `revealed_en[i]` and `revealed_sv[i]` are tracked independently per line; tapping the coloured EN bubble toggles `revealed_en[i]`, tapping the grey SV bubble toggles `revealed_sv[i]`; the *Reveal next →* button (or `space`) advances a linear EN-then-SV-then-next-line sequence
- History list + cursor for prev / replay / next navigation

---

## Adding scenarios

### Adding a new pool entry

Find the pool in `POOLS` and add an entry. **Fill in every field the existing entries have.** A template that references a missing field throws a runtime error.

Required fields per pool (current schema):

| Pool | Required fields |
|---|---|
| `food` | `en_indef`, `en_def`, `sv_indef`, `sv_def`, `en_likes`, `sv_likes`, `en_pron`, `sv_pron`, `En_pron`, `Sv_pron`, `gender` |
| `place` | `en_indef`, `en_def`, `sv_indef`, `sv_def`, `at_en`, `at_sv`, `to_en`, `to_sv`, `from_en`, `from_sv`, `gender`, `sv_pron`, `Sv_pron`. Optionally `is_business: true` for places that have business hours. |
| `object` | all of `food`'s fields, plus `en_my`, `sv_my`, `en_mine`, `sv_mine` |
| `furniture` | `en_on`, `sv_on` (full prepositional phrase, e.g., `"on the desk"` / `"på skrivbordet"`) |
| `activity` | `en_ing`, `sv_ing` (gerund / att-infinitive, e.g., `"swimming"` / `"att simma"`) |
| `time` / `past_time` / `future_time` / `clock` | `en`, `sv` |
| `floor`, `country`, `year`, `years_count` | `en`, `sv` |
| `colored_thing` | `en_def`, `sv_def`, `en_that`, `sv_that`, `en_mine`, `sv_mine`, `en_pron`, `sv_pron`, `En_pron`, `Sv_pron`, `en_is_new`, `sv_is_new`, `en_quite_new`, `sv_quite_new`, `en_we_bought`, `sv_we_bought`, `sv_which`, `gender`, `category` |
| `verb` | `en_do_you`, `sv_do_you`, `en_yes_i`, `sv_yes_i`, `en_no_i`, `sv_no_i` |

Convention: **prepositional phrases include the preposition**. So `at_sv: "på kontoret"` (not `"kontoret"`). Templates write `{p.at_sv}` and get a complete adverbial — no preposition guessing in the template.

### Adding a new template

Append to the `TEMPLATES` array:

```js
{
  id: "unique-string-id",
  tags: ["category1", "category2"],
  speakers: ["A","B","A","B"],
  slots: { thing: "food", spot: "furniture" },
  en: [
    "Where is {thing.en_def}?",
    "It's {spot.en_on}.",
    "Ah, thanks.",
    "No problem."
  ],
  sv: [
    "Var är {thing.sv_def}?",
    "{thing.Sv_pron} är {spot.sv_on}.",
    "Aha, tack.",
    "Inga problem."
  ],
}
```

Tense rule: **past-tense templates use `past_time`, future-tense templates use `future_time`, mixed/either use `time`.** This prevents "vi har köpt det imorgon" (bought-it-tomorrow) nonsense.

### Adding a whole scenario with an AI agent

Open the directory in Claude Code / Cursor / Cline / whatever, and paste this prompt:

> Read `dialog.html` and `README.md`. I want to add a new scenario to the dialog drill generator.
>
> **Scenario:** _[describe what you want — e.g., "buying a train ticket at the station with reservation, price questions, polite hesitation"]_
>
> Follow these rules:
> 1. **Pre-bake all Swedish grammar.** Never compose forms in templates — every inflected form (definite, indefinite, possessive matching gender, anaphoric pronoun, prepositional phrase, adjective+noun in definite, demonstrative) must already exist in the pool entry. The engine only picks; it doesn't inflect.
> 2. If existing pools have what you need, add entries to them. Every new entry must include every field the existing entries of that pool already have — otherwise templates that reference those fields will crash.
> 3. If you need new vocabulary not in existing pools, add pool entries to the matching pool (or define a new pool if needed).
> 4. Write 2–4 templates per scenario, covering different branches: yes/no, success/failure, polite/casual, has-it/doesn't-have-it. Each 3–6 lines.
> 5. Past-tense templates must use the `past_time` pool, future-tense templates use `future_time`, neutral/either use `time`.
> 6. For en/ett-words: `sv_pron` must be `"den"` for en-words, `"det"` for ett-words; `Sv_pron` is the capitalized version. Same for `sv_mine`: `"min"` (en) vs `"mitt"` (ett).
> 7. After editing, validate by running:
>    ```bash
>    node -e "$(cat <<'EOF'
>    const fs = require('fs');
>    const html = fs.readFileSync('dialog.html','utf8');
>    const js = html.match(/<script>([\s\S]*?)<\/script>/)[1];
>    const cutoff = js.indexOf('// SHARED-SESSION CONFIG');
>    fs.writeFileSync('/tmp/sv.cjs', js.slice(0,cutoff) + '; module.exports = { POOLS, TEMPLATES, buildDialog };');
>    const { POOLS, TEMPLATES, buildDialog } = require('/tmp/sv.cjs');
>    let f=0;
>    for (const t of TEMPLATES) {
>      for (const line of [...t.en, ...t.sv]) {
>        for (const m of line.matchAll(/\{(\w+)\.(\w+)(?:\|\w+)?\}/g)) {
>          const pool = POOLS[t.slots[m[1]]];
>          if (!pool) { console.log('Bad pool ref in', t.id, m[0]); f++; continue; }
>          const miss = pool.filter(e => e[m[2]] === undefined);
>          if (miss.length) { console.log(t.id, '→', m[0], 'missing on', miss.length, 'entries'); f++; }
>        }
>      }
>    }
>    console.log(f ? 'FAIL' : 'OK');
>    EOF
>    )"
>    ```
>    Fix anything it complains about before reporting done.

That prompt is self-sufficient — an agent can extend the system without re-explaining each time.

---

## Deployment

The deployed copy lives at **<https://playabend.com/svenska/>**, served from the `svenska/` folder of the [`playabend.com`](https://github.com/LaszloPinter/playabend.com) repo (GitHub Pages with custom domain). To update:

1. Make changes in `/Users/laszlopinter/Projects/svenska/` (this directory)
2. Copy the four HTML files (`index.html`, `database.html`, `dialog.html`, `teacher-guide.html`) and `README.md` to `/Users/laszlopinter/Projects/playabend.com/svenska/`
3. `git add svenska/ && git commit && git push` from the playabend.com repo

---

## Live shared sessions (teacher ↔ student via Firebase)

`dialog.html` supports a shared mode where the teacher drives the page and the student sees a synced view in real time. Setup is one-time, ~5 minutes.

### One-time setup

1. **Create a Firebase project** at <https://console.firebase.google.com>. Skip Google Analytics.

2. **Add a Realtime Database**: in the left sidebar → **Build → Realtime Database → Create Database**. Pick a location. Start in **test mode** for now.

3. **Register a web app**: Project settings (⚙️) → **General → Your apps → Web (`</>`)**. Register, then copy the `firebaseConfig` snippet.

4. **Paste the config into `dialog.html`**: find the `FIREBASE_CONFIG` block (search for `apiKey`), replace the values.

5. **Set a passcode in the database**. In Firebase Console → Realtime Database → **Data** tab:
   - Hover over the root node
   - Click the **+** icon
   - Add a child named `secret`, value = the passcode (e.g., `lesson-2026`)
   - End state: `/secret = "your-passcode-here"` at the root

6. **Set security rules**. In Firebase Console → Realtime Database → **Rules** tab, paste:

   ```json
   {
     "rules": {
       "secret": {
         ".read":  false,
         ".write": false
       },
       "sessions": {
         "$sessionId": {
           ".read":  true,
           ".write": "newData.child('passcode').val() === root.child('secret').val()"
         }
       }
     }
   }
   ```

   What this does:
   - `secret` is unreadable + unwritable to clients (only manual edits via the Firebase Console can change it)
   - Sessions can be read by anyone who knows the session ID
   - Sessions can only be written by clients that include the correct passcode in every write — which is what the wizard collects and stores in `localStorage`

   Click **Publish**.

7. **Deploy** the updated files to the `playabend.com/svenska/` folder (see Deployment section).

> About the apiKey: it's published in the page — that's normal for Firebase web apps. Real security is enforced by the database rules, not the apiKey.

### Usage

1. The student opens the landing page (`index.html`), enters the **passcode**, and clicks **Start session**. The page validates the passcode by writing the initial state. If accepted, it stores the passcode in `localStorage` and pops a modal containing the student link (auto-copied to the clipboard, with a "Share…" button on mobile).
2. The student shares that link with the teacher (it's already on the clipboard) and clicks **Open teacher view →** in the modal to enter the session as the controller.
3. The teacher opens the student link. Both views mirror in real time.

The dialog page also has a **Copy student link** button in the teacher controls, so the link can be re-shared later without going back to the landing.

If the page shows `Code-EXX`, check the browser console for the underlying error. Most commonly: rules not published yet, or a network blip — refresh.

### Visibility model (teacher controls what the student sees)

Each line has two independent flags: `revealed_en[i]` and `revealed_sv[i]`.

| Student sees | Default mode | Strict mode | Show All |
|---|---|---|---|
| Own line, neither revealed | EN visible, SV hidden | EN hidden, SV hidden | Both visible |
| Own line, EN revealed | EN visible, SV hidden | EN visible, SV hidden | Both visible |
| Own line, both revealed | Both visible | Both visible | Both visible |
| Teacher's line, nothing revealed | Both hidden | Both hidden | Both visible |
| Teacher's line, EN revealed | EN visible, SV hidden | EN visible, SV hidden | Both visible |
| Teacher's line, both revealed | Both visible | Both visible | Both visible |

The teacher always sees everything. Bubbles that aren't yet revealed to the student appear in a muted grey-with-coloured-border state on the teacher's view; revealed bubbles fill in with the full speaker colour. SV bubbles revealed to the student also get a green border.

Teacher controls:
- **Tap any coloured (EN) bubble** → toggle EN reveal for the student
- **Tap any grey (SV) bubble** → toggle SV reveal for the student
- **Reveal next →** (or `space`) → step through linearly: line 0 EN → line 0 SV → line 1 EN → …
- **`shift` + `space`** → step back (hide most recent reveal)
- **Reveal all / Hide all** → flip all sides at once
- **Show all to student** toggle → live override
- **Strict** toggle → hide the student's own EN lines too
- **Student speaks as: A / B** → assign which speaker is the student
- **Next / Prev dialog** → generate a fresh dialog / navigate history

### Costs

Firebase free tier covers a teacher+student session trivially. The whole session writes maybe 1 KB per Next press and a few hundred bytes per reveal.

### Falling back

If `dialog.html` is opened without a `session=` URL parameter, the wizard appears and offers a **Skip — practice solo** link that drops into single-user mode (no Firebase). This also runs if Firebase isn't configured at all.

---

## Error codes

User-facing errors are intentionally opaque (`Code-EXX`) to avoid leaking the tech stack. The console has full details. Code mapping:

| Code | Location | Likely cause |
|---|---|---|
| E01 | initial page load | Backend SDK didn't load — CDN blocked / offline |
| E02 | initial page load | Backend init threw |
| E03 | teacher writing (silent → re-prompt) | Stored passcode no longer matches the secret |
| E04 | teacher writing | Write failed for non-passcode reason |
| E05 | wizard Start | Backend SDK didn't load |
| E06 | wizard Start | Backend init threw |
| E07 | wizard Start (shown as "Wrong passcode.") | Passcode mismatch |
| E08 | wizard Start | Write failed for non-passcode reason |
| E09 | session URL with no config | `dialog.html` opened with `?session=` but `FIREBASE_CONFIG` is still placeholders |
