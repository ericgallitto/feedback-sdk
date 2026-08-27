# Demo video: voiceover script

Companion to `docs/media/demo.mp4`. The video is a single unbroken screen recording of the
widget being used against `examples/next-demo`, 37.3 seconds at 1920x1200, 30fps, no audio.

Everything in it is real. Nothing was mocked or sped up, and the submit at the end is a live
round trip to the API server writing to SQLite.

---

## Voice direction

Read it plainly. The product is a tool for engineers and product people, and the thing that
sells it is that it removes a specific annoyance, not that it is exciting.

- **Pace:** unhurried. Roughly 2.5 words per second. There is deliberate silence between
  lines and the silence is doing work: it lets the viewer watch the outline move.
- **Tone:** matter of fact. A colleague showing you something useful, not an announcer.
- **Avoid:** rising inflection at the end of sentences, emphasis on adjectives, and any
  version of "seamlessly", "effortlessly", "game changing", or "revolutionise".
- **Emphasis:** put it on the nouns that carry meaning. "They point at the **part of the
  page** they mean." Not "they **point** at the part of the page they mean."

A neutral British or American voice both work. Avoid anything with a smile in it.

---

## Timed script

Timecodes are the start of each line and match `docs/media/demo-beats.json`, which was
written by the recording harness. Word counts are given so you can check a generated read
fits before rendering the whole thing.

| In | Out | On screen | Voiceover | Words |
|---|---|---|---|---|
| 0.0 | 4.2 | The demo page, at rest | Somebody on your team just found a problem with your product. | 11 |
| 4.3 | 6.5 | Composer opens | Normally that becomes a vague message in Slack. | 8 |
| 6.6 | 8.5 | Picking mode begins | This is the alternative. | 4 |
| 8.6 | 13.1 | Dashed outline follows the cursor across three cards | They point at the part of the page they mean. Whatever they hover is outlined. | 15 |
| 13.2 | 16.2 | Cursor returns to the second card | There is no guesswork about what is being reported. | 9 |
| 16.3 | 19.3 | Click. The outline turns solid, composer returns | Clicking locks it, and the outline stays. | 7 |
| 19.4 | 22.8 | Typing, outline still visible behind the composer | So they can see exactly what they are describing while they describe it. | 13 |
| 22.9 | 26.1 | "Pick a different one", back to the page | Picked the wrong thing? Choose another. What they wrote is kept. | 11 |
| 26.2 | 29.0 | New card selected, comment intact in the composer | Their words survive the change of target. | 7 |
| 29.1 | 33.8 | Category set to Confusing, email entered | A category, and a way to reach them, because a report you cannot follow up on is a report you cannot act on. | 23 |
| 33.9 | 36.4 | Send. Request goes to the API | The element, its position in the page, the surrounding text, all of it goes with the words. | 17 |
| 36.5 | 37.3 | "Sent. Thank you." Outline still on the card | Now it is something you can work from. | 8 |

**Total:** 133 words across 37.3 seconds. That is comfortably under a 2.5 words per second
read, so there is room to slow down rather than rush.

### Where to leave silence

Do not fill 8.6 to 13.1 with more words than the line above. That stretch is the whole
argument for the product and it is carried by the picture: the outline moving from card to
card as the cursor travels. A read that talks over it is a worse demo.

---

## Fifteen second cut

For a social post or a README embed. Use the video from 6.6 to 22.0, which is picking mode
through the first typed comment.

| In | Out | Voiceover | Words |
|---|---|---|---|
| 0.0 | 1.5 | Feedback on a page, without the guesswork. | 7 |
| 1.6 | 6.5 | They point at what they mean, and whatever they hover is outlined. | 12 |
| 6.6 | 10.5 | Clicking locks it. The outline stays while they write. | 9 |
| 10.6 | 15.0 | The element and its context go with the words. | 9 |

**Total:** 37 words across 15 seconds.

---

## Production notes

- **Captions.** Burn them in. Most of this will be watched without sound. Keep them at the
  bottom centre, and make sure they do not sit over the composer, which occupies the lower
  right from 4.3 onward.
- **Music.** Optional, and if used, keep it under the read by a wide margin. Something
  without a strong beat: a beat pulls the eye away from the outline, which is the one thing
  the viewer needs to be watching.
- **No intro card.** The first frame should be the product. A title card in a 37 second
  video costs a tenth of its length.
- **End card**, if you want one: the package name and the install line, held for two
  seconds after the confirmation.

  ```
  npm install @ericgallitto/feedback-react
  ```

- **Export.** H.264, 1920x1200, 30fps. The source is already that, so re-encode once at
  most. The file is 791KB, which is small enough to embed directly in a README.

---

## What the recording actually shows

Useful if you are cutting it differently or writing your own read. Each of these is a real
behaviour, not a staged frame.

1. **0.0** The demo page at rest. The trigger sits in the bottom right and says `feedback`
   in a monospace face rather than showing an icon.
2. **4.3** The composer opens. It is a panel, not a modal over the whole screen, so the page
   stays visible behind it.
3. **6.6** Picking mode. The hint bar appears at the top. The overlay does not tint the page,
   because a tint would sit over the element it is meant to be showing you.
4. **8.6 to 13.1** Hover preview. The dashed outline tracks across three cards. Exactly one
   element is outlined at any moment.
5. **16.3** Selection. The outline turns solid and the composer returns, with the chosen
   element named in monospace at the top of the panel.
6. **19.4** Typing. The outline is still on the card, behind the panel. This is the part
   most feedback tools do not do.
7. **22.9** Reselection. "Pick a different one" returns to the page. The typed comment is
   still there when the new target is chosen at 26.2.
8. **29.1** Category and email. The demo runs the widget in anonymous mode, which is why it
   asks for an address.
9. **33.9** Submit. A real POST to the API server, which writes to SQLite.
10. **36.5** Confirmation. The outline is still up, so the last thing on screen is the
    element the words were attached to.

---

## Reproducing the recording

The video was made by driving a real browser over the DevTools protocol, so it can be
regenerated after any UI change rather than re-recorded by hand.

```bash
# Terminal 1: the collector
cd examples/next-demo
FEEDBACK_STORE=sqlite FEEDBACK_SQLITE_PATH=./feedback.db FEEDBACK_DEMO_MODE=true \
  node ../../integrations/api/dist/server.js

# Terminal 2: the demo app
cd examples/next-demo && PORT=3311 pnpm dev

# Terminal 3: Chrome with remote debugging, on its own profile so it does not
# disturb a running browser
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-demo
```

The harness moves a synthetic cursor, because a screencast captures the page and not the
operating system pointer. That cursor carries a `data-feedback-ui` attribute, which is the
same attribute the widget uses to avoid ever targeting its own interface, so the picker
ignores it.
