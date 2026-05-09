4-hour hackathon spec: Audio EQ + Style Recommendation Dashboard
Project name

MixLens
A GenUI web app that takes an uploaded audio clip and returns an interactive dashboard with EQ analysis, mix/style insights, and actionable recommendations. Stretch goal: let the user apply EQ changes and export a processed .wav.

1. Goal

Build a web app where a user can upload a short audio clip, preferably 10–60 seconds, and get:

Audio overview
Duration
Loudness estimate
Peak level
Basic waveform preview
EQ / spectral analysis
Low, low-mid, mid, high-mid, and high frequency balance
Detection of common mix issues:
Too boomy
Muddy low-mids
Harsh upper mids
Dull top end
Thin low end
Style recommendations
“This sounds close to: warm vocal demo / bright pop mix / lo-fi beat / podcast voice / bass-heavy electronic clip”
Suggested mix direction:
Warmer
Brighter
Cleaner
More punchy
Less harsh
More balanced
GenUI dashboard
The analysis should not just be static text.
It should generate a dashboard layout based on the audio results:
Cards
Charts
Recommended EQ moves
Confidence / severity indicators
“Before / suggested target” comparison
2. MVP user flow
Step 1: Upload audio

User uploads a .wav or .mp3.

Constraints for hackathon:

Max length: 60 seconds
Max file size: maybe 20 MB
Convert to mono for analysis
Downsample if needed
Step 2: Analyze clip

Backend extracts:

Waveform data
RMS / loudness proxy
Peak amplitude
Frequency spectrum
Energy per frequency band

Suggested bands:

Band	Range	Interpretation
Sub / Bass	20–120 Hz	Weight, boom, rumble
Low-mids	120–500 Hz	Warmth, mud
Mids	500 Hz–2 kHz	Body, presence
High-mids	2–6 kHz	Clarity, harshness
Highs	6–16 kHz	Air, brightness
Step 3: Generate analysis

The system turns numeric band energy into simple judgments.

Example:

{
  "summary": "The clip is warm and bass-heavy, with some muddiness around the low-mids.",
  "style": "Lo-fi / warm vocal demo",
  "issues": [
    {
      "label": "Low-mid buildup",
      "severity": "medium",
      "range": "200–400 Hz",
      "recommendation": "Try cutting 2–3 dB around 300 Hz to reduce muddiness."
    },
    {
      "label": "Slightly dull top end",
      "severity": "low",
      "range": "8–12 kHz",
      "recommendation": "Try a gentle high shelf boost above 8 kHz."
    }
  ],
  "eqMoves": [
    {
      "type": "bell",
      "frequency": 300,
      "gainDb": -2.5,
      "q": 1.2,
      "reason": "Reduce muddiness"
    },
    {
      "type": "high_shelf",
      "frequency": 8000,
      "gainDb": 1.5,
      "q": 0.7,
      "reason": "Add air"
    }
  ]
}
Step 4: Render dashboard

Dashboard components:

Upload panel
Waveform preview
Frequency balance chart
EQ recommendation cards
Style summary card
Suggested EQ curve
“Apply EQ” stretch button
Download processed WAV” stretch button
3. GenUI angle

The strongest hackathon angle is:

The app generates a custom dashboard based on the audio’s actual sonic profile.

Instead of always showing the same UI, the dashboard adapts.

Examples:

If audio is muddy

Show:

“Mud Risk” card
Low-mid frequency chart emphasized
Cut recommendation around 200–400 Hz
If audio is harsh

Show:

“Harshness Alert” card
High-mid region highlighted
Suggested cut around 3–5 kHz
If audio is dull

Show:

“Brightness Opportunity” card
High shelf recommendation
Style suggestion like “could use more pop sheen”
If audio is balanced

Show:

“Balanced Mix” card
Minor polish suggestions
“No aggressive EQ needed”
4. Recommended stack
Frontend
Next.js
React
Tailwind
Recharts for charts
Wavesurfer.js for waveform preview
CopilotKit for GenUI / assistant interaction
Backend

Simplest path:

Next.js API route
Python microservice, or Node-based audio analysis

For a 4-hour hackathon, I would choose:

Option A: Python backend

librosa
numpy
scipy
soundfile

Better for audio analysis and WAV export.

Option B: Node only

meyda
web-audio-api
ffmpeg.wasm or server-side ffmpeg

Faster if the team is JS-heavy, but audio analysis may be messier.

5. 4-hour build plan
Hour 0–1: Core upload + analysis

Build:

Audio upload UI
Backend endpoint: /api/analyze
Extract:
Duration
Peak
RMS
FFT / frequency band energy
Simple band ratios

Output a JSON analysis object.

MVP success condition:

Upload a file
Get back meaningful numeric EQ data
Hour 1–2: Dashboard UI

Build:

Waveform preview
Frequency band bar chart
Summary card
Recommendation cards
EQ move list

MVP success condition:

One uploaded clip produces a visually compelling dashboard.
Hour 2–3: Recommendation engine + GenUI polish

Build rules like:

if (lowMidEnergy > averageEnergy * 1.25) {
  addIssue("Muddy low-mids", "Cut 250–400 Hz by 2–3 dB");
}

if (highMidEnergy > averageEnergy * 1.35) {
  addIssue("Harshness", "Cut 3–5 kHz by 1–3 dB");
}

if (highEnergy < averageEnergy * 0.75) {
  addIssue("Dull top end", "Boost above 8 kHz with a high shelf");
}

Add CopilotKit assistant behavior:

“Explain this mix”
“Make this warmer”
“What EQ should I try?”
“Give me producer-style feedback”

MVP success condition:

The assistant can explain the generated dashboard and recommendations.
Hour 3–4: Demo polish

Add:

Sample audio clips
Loading states
Better visual styling
“Severity” badges
“Suggested EQ curve” chart
Demo script

MVP success condition:

The app feels like a real product, even if the analysis is simple.
6. Stretch goal: apply EQ and export WAV

Only do this after the analysis dashboard works.

Stretch feature

User clicks:

Apply suggested EQ

Then the backend:

Loads original audio
Applies recommended EQ filters
Normalizes output safely
Returns processed .wav
Backend approach

Use Python:

scipy.signal
soundfile
Optional: pydub
Optional: pedalboard if available

Suggested filter support:

Bell filter
Low shelf
High shelf

For hackathon simplicity, you can fake shelves using broad EQ filters or implement only bell filters first.

Stretch flow
Upload audio
→ Analyze
→ Generate EQ recommendations
→ User clicks “Apply EQ”
→ Backend applies filters
→ User previews processed audio
→ User downloads WAV
Stretch API
POST /api/process

Request:

{
  "audioFileId": "abc123",
  "eqMoves": [
    {
      "type": "bell",
      "frequency": 300,
      "gainDb": -2.5,
      "q": 1.2
    },
    {
      "type": "high_shelf",
      "frequency": 8000,
      "gainDb": 1.5,
      "q": 0.7
    }
  ]
}

Response:

{
  "processedAudioUrl": "/outputs/abc123-processed.wav"
}
7. Keep the MVP honest

Do not try to build:

Full mastering
Perfect genre detection
Stem separation
Vocal/instrument isolation
True LUFS normalization
DAW-level EQ controls
Real-time processing

Do build:

Useful approximate analysis
Beautiful dashboard
Clear recommendations
A convincing assistant experience
Optional WAV export if time allows
8. Demo script
Upload a clip.
Dashboard appears.
Point out:
“The app found low-mid buildup.”
“It recommends cutting around 300 Hz.”
“It also thinks the track is slightly dull, so it suggests a high shelf.”
Ask the Copilot assistant:
“How would I make this sound more polished?”
Assistant responds with contextual recommendations.
Stretch:
Click “Apply EQ”
Play/download the processed WAV.
9. One-sentence pitch

MixLens turns any short audio clip into an interactive AI-generated mix dashboard, showing EQ balance, sonic style, and practical producer-style recommendations, with an optional one-click EQ export to WAV.