# Field notes: consuming feedback as an AI agent

*Written 2026-09-02 by Claude, after two days using feedback-sdk as the feedback
channel on a live internal app (a sales-analytics dashboard). Ten
items filed by one person, eight of them acted on.*

This is not a review of the SDK. It is a record of what an AI coding agent hits
when it tries to be the consumer end of the loop, which is the use the README
leads with:

> AI coding tools subscribe to feedback as a built-in data source.

Reading the source corrected two things I was going to report, and one finding
turned out to be a bug in my own tooling rather than in the SDK. Both are
included, because "I was wrong about this" is more useful to you than a clean
list.

Ordered worst first.

---

## 1. MCP cannot reach a deployed app

**The one that matters.** The MCP server exists and is good —
`@ericgallitto/feedback-mcp`, exposing `list_feedback`, `get`, `update` and
`summarize`. It is also the headline of the README and the reason an agent would
adopt this over a spreadsheet.

It supports two stores, and neither is remote. `integrations/mcp/src/server.ts`
reads `FEEDBACK_STORE` and offers `memory` or `sqlite`:

```ts
const storeType = process.env['FEEDBACK_STORE'] ?? 'memory'
if (storeType === 'sqlite') { … } else { createMemoryStore() }
```

There is no HTTP-backed `FeedbackStore`. So an MCP client cannot talk to an app
whose feedback lives in a hosted database behind a deployed API — which is every
real installation of this, including the one I was working in.

**What happened as a result.** I could not use MCP at all. I wrote a CLI against
`/api/feedback` instead, including handling for the deployment-protection bypass
the host app sits behind. That took an hour and it is not something a
non-technical adopter would do. Anyone who installs this expecting the README's
promise, and whose feedback is in Postgres rather than a local file, will hit the
same wall.

The two halves are inverted: the HTTP path reaches real data and has no agent
story; the MCP path has the agent story and reaches only local data.

**Suggested fix, and it is small.** `createHttpStore({ baseUrl, headers })`
implementing the same `FeedbackStore` interface the other two already satisfy.
`storage-sqlite` is the template. Then:

```
FEEDBACK_STORE=http
FEEDBACK_API_URL=https://myapp.example.com/api/feedback
FEEDBACK_API_HEADERS={"authorization":"Bearer …"}
```

and the MCP server works against any deployment. Headers rather than a bare
token, because every host will front this differently — bearer, cookie, a
platform bypass header. Ours needed the last of those.

---

## 2. The positional fallback breaks exactly when feedback is heaviest

I was going to report that captured selectors are brittle. They are not, by
design — `packages/core/src/selector.ts` prefers `#id`, then walks up to the
nearest `data-feedback-label`. The mechanism is there and it is the right one.

The issue is what happens when a host app has not used it, which is the default
and is what ours had done. The fallback is positional:

```
section:nth-of-type(1) > div:nth-of-type(4)
```

Two items filed one morning pointed at the wrong element by the afternoon,
because I had added a section above them.

**The host's read on why, which sharpens rather than excuses it:**

> the sections changing likely happened because work was in motion and changes
> were being pushed as I made the feedback … on a live site it would be fine

That is right. A positional selector is stable on a settled site. It degrades
while a page is being actively edited — which is precisely the phase where
feedback arrives fastest, and precisely the phase this tool is best at serving.
It is least reliable exactly when it is most used.

**Two suggestions.**

Carry the kind of selector on the record:

```ts
selector_stability: 'id' | 'labelled' | 'positional'
```

An agent can then say "this anchor is positional and the page has changed since,
let me confirm before editing" instead of confidently editing the wrong
component. Right now nothing distinguishes a durable anchor from a guess.

And say `data-feedback-label` out loud in the setup wizard. It is the single
change a host app can make that removes this whole class of problem, and nothing
in the install flow mentions it.

---

## 3. `textContent` concatenates across elements

`packages/core/src/context.ts` reads `el.textContent`, which joins block-level
children with no separator. A section heading and its note came through as:

```
Activity by segmenteach against its own benchmark, because t
```

Two problems in one string: no space where two elements met, and a cut at 60
characters that landed mid-word.

**Suggestion.** `innerText` respects rendered line breaks and would have given
`Activity by segment each against its own benchmark`. If `innerText` is
unattractive because it forces layout, join child text nodes with a space. Either
way, trim on a word boundary rather than a character count.

---

## 4. Surrounding text swallows form controls

`captureSurroundingText` normalises whitespace correctly, then takes the parent's
entire `textContent` — including every `<option>` inside a `<select>`. One record
carried:

```
Current cohortWhich cohort to showSeptember 2026 (current)August 2026July 2026
June 2026May 2026April 2026March 2026February 2026N items · stage 2 of 5…
```

Most of that 300-character budget is a dropdown's contents. The genuinely useful
context — what the section was and what it said — is crowded out.

**Suggestion.** Clone the parent, remove `select`, `option`, `input` and
`textarea`, then read. Same budget, far more signal.

---

## 5. "Not now" exists, but only after the fact

Four of the ten items said, in prose, that they were for later: *"maybe not
immediately"*, *"NOT right now"*, *"for future implementation"*.

The capability is there — `status: deferred` is in the contract and the host
app's admin UI can set it. But nothing collects it at capture, so the author's
intent lives in prose until a human re-reads it and sets the status by hand.

**Most of this one was my bug, not yours.** My CLI never read or wrote `status`
at all: it listed deferred work as though it were outstanding, and its "mark
done" wrote `accepted` unconditionally — conflating *this shipped* with *this was
a good idea*, which are different claims. I have fixed that. It is worth
recording because it is the mistake the next agent integration will also make:
`pipeline_state` is the obvious field and `status` is easy to miss entirely.

**What is left for the SDK** is that the round trip is avoidable. See the next
finding — it fits in the category list rather than needing a field of its own.

---

## 6. The modal asks the wrong two questions

**Categories do not match what people file.** The defaults are Bug, UI
Suggestion, Missing Feature, Confusing, General. Of ten real items, **nine came
through as `general`** and one as `ui_suggestion`.

When ninety percent of traffic lands in the escape hatch, the taxonomy is
describing a mental model the filer does not have. The host's verdict was blunter
than mine: *"the options in the category dropdown are bad and not useful."*

They are named after what a thing *is*. People file based on what they want to
*happen*. A set that follows the second:

| Option | Means |
|---|---|
| **Broken** | It does not work |
| **Confusing** | I cannot tell what this means |
| **Change this** | It works, but it should be different |
| **Add this** | It is not here yet |
| **Idea for later** | Not now, but worth keeping |

The last one closes finding 5 without a new field: filing as *Idea for later*
sets `status: deferred` at capture, so the author's own "not right now" becomes a
state rather than prose someone has to re-read.

**Priority is absent from the modal**, which is why it is null on every record —
the field exists on the contract and nothing collects it. The host's proposed
wording, which is the right kind of scale because it asks about *impact* rather
than asking someone to rank their own request:

| | |
|---|---|
| **Low** | I would like help with this |
| **Medium** | I am currently impacted by this |
| **High** | I cannot do my job |
| **Urgent** | My team and I cannot do our jobs |

One contract note: `priority` is typed `1–5` and this is a four-point scale.
Low→1 through Urgent→4 leaves 5 unused, which is harmless but untidy; narrowing
to 1–4 is cleaner and is a breaking change. Worth deciding rather than
discovering.

---

## 7. Nothing links an item to the work that closed it

After an item reaches `shipped` there is no field for the commit, PR or release
that shipped it. `admin_notes` is free text and would work, but nothing suggests
that use and nothing can query it.

An audit trail that cannot say *what* closed an item is a log, not a trail — and
being a trail is the reason to use this instead of chat. A `resolution_ref`
string would be enough.

---

## 8. `page_url` records the deploy hostname

Every one of our records carries the branch deployment host:

```
myapp-git-main-myteam-projects.vercel.app
```

not the canonical URL. Feedback on a single page therefore fragments across every
deployment it happened to be filed from, so grouping by page degrades over time —
worse on platforms that give every branch its own hostname, which is most of
them now.

**Suggestion.** An optional `canonicalUrl` on the widget config, or derive from
`<link rel="canonical">` when present.

---

## What worked well, since a notes file that is all complaints is misleading

**Element context is the feature.** Being handed the page, the section heading
and the surrounding text meant a note pointed at a thing instead of describing
it. Two items I would have had to ask clarifying questions about were actionable
immediately.

**The pipeline states are the right ones.** `captured → triaged → plan_approved →
in_progress → code_review → ship_approved → shipped → closed` maps onto how the
work actually went, including the two human approval gates. I used `triaged` to
mean "planned, not started" and it fit without stretching.

**Status and pipeline state being separate is correct**, even though it is the
thing I got wrong. How far along something is, and whether anyone still wants it,
are genuinely different questions. Most trackers collapse them and are worse for
it.

**Filing from the page beat filing in chat**, measurably. The same person
describing the same problem in conversation gave me less to work with than the
widget did, because the widget captured what they were looking at and the
conversation assumed I knew.
