---
artifactType: "thinkrun.share"
schemaVersion: "2026-06-21"
sourceType: "recording"
title: "Playwright CLI vs MCP (285 Tests): Which Should You Use?"
intendedUse: "Portable share artifact for human or agent review."
captureMode: "feedback-recording"
analysisStatus: "complete"
summaryPresent: true
canonicalEntrypoint: "https://thinkrun.ai/s/Yt9Qk5rHtnCJckXku53Nfq-5uKxONQxcA9ufdndohgA.json"
primaryUrl: "https://youtu.be/7MiJN2htFtE"
durationMs: 330900
sourceId: "b2abbed0-6df0-4564-99e3-d000756fa93c"
shareToken: "Yt9Qk5rHtnCJckXku53Nfq-5uKxONQxcA9ufdndohgA"
feedbackType: "demonstration"
useCase: "Demonstration walkthrough"
userReportedFeedbackCount: 6
directObservationCount: 7
suggestedChangeCount: 7
transcriptAvailable: true
screenshotCount: 34
navigationCount: 0
consoleLogCount: 0
networkRequestCount: 0
domSnapshotCount: 0
recommendedConsumptionOrder:
  - "canonical_json"
  - "summary"
  - "userReportedFeedback"
  - "directObservations"
  - "suggestedChanges"
  - "analysis"
  - "screenshots"
  - "transcript"
  - "video"
availableSections:
  - "context"
  - "evidence"
  - "analysis"
  - "summary"
  - "userReportedFeedback"
  - "directObservations"
  - "suggestedChanges"
  - "screenshots"
  - "transcript"
  - "video"
---

> **What this is.** ThinkRun's own analysis of the video, exported as Markdown from the public share page on
> 2026-11-09 and kept here unedited below this note. Live versions:
> [share page](https://thinkrun.ai/s/Yt9Qk5rHtnCJckXku53Nfq-5uKxONQxcA9ufdndohgA) · [Markdown](https://thinkrun.ai/s/Yt9Qk5rHtnCJckXku53Nfq-5uKxONQxcA9ufdndohgA.md) · [JSON](https://thinkrun.ai/s/Yt9Qk5rHtnCJckXku53Nfq-5uKxONQxcA9ufdndohgA.json).
>
> **We checked it against the data, as the video recommends** (check the result, not the reply):
>
> - The numbers in the summary, key moments and issues are correct. The checks are `verify-claims.ts` and `speed.ts` in this folder.
> - **The timestamps are wrong.** They are compressed into the first 0:21 of a 5:31 video. For example, the 97K vs 2.9M
>   moment is at about 3:15, not 0:06.
> - "Claude Sonnet 5.5 and GPT-6.1 Sol completed all step-by-step runs (25/25), while Luna only succeeded on 20/25"
>   mixes up two experiments. 25/25 and 20/25 are the **write-once reruns**. In the step-by-step runs, Luna stopped early
>   in 5 of 15.
> - "Without compensating benefits in speed or reliability" and "dynamic or new pages favor CLI" are the analysis's own
>   inferences. We didn't measure the first, and the video doesn't favour either tool for new pages; it says to keep the
>   agent driving there.
> - One screenshot caption reads "51 browser calls and 0 tokens". The counter was caught mid-animation; it ends at 2,938,469.

# Playwright CLI vs MCP (285 Tests): Which Should You Use?

Duration: 5m 31s · Type: recording · Intent: feedback · Use case: Demonstration walkthrough · Status: complete

## What Happened
A ThinkRun benchmark presentation comparing Playwright CLI vs MCP across 285 test runs on three AI models (Claude Sonnet 5.5, GPT-6 Luna, GPT-6.1 Sol). The key finding is that tool choice (CLI vs MCP) matters less than model selection and agent behavior strategy. Token usage varies significantly by task type, model, and whether agents write scripts or click through sequentially.

## Key Moments
- 0:00 — Problem statement: Playwright token usage limits (narration): Speaker introduces the problem that coding agents using Playwright can rapidly consume subscription token limits (5-hour or weekly caps), prompting investigation into efficient Playwright setups.
- 0:02 — Benchmark methodology shown (highlight): Visual shows 285 total runs tested, with 277 passed and 8 failed. Three models compared (Claude Sonnet 5.5, GPT-6 Luna, GPT-6.1 Sol) across two task types: Playwright docs task and a test shop task.
- 0:03 — Task-dependent token efficiency reversal (state\_change): On Playwright docs task, MCP used fewer tokens than CLI on OpenAI models (half as many on Luna, 15% fewer on Sol). On shop task, CLI used 40-50% fewer tokens on Claude and 26-47% fewer on Luna—opposite result.
- 0:06 — Script writing vs interactive clicking comparison (highlight): GPT-6 Luna with MCP: writing a script used 97K tokens (3 calls), while clicking through 8 items used 2.9M tokens (51 calls)—a 30× difference in the same task.
- 0:13 — Step-by-step instruction impact (highlight): When agents were instructed to take one action at a time with no scripts, token usage increased 6-27× across all models and both tools. GPT-6 Luna also failed on 5 of 15 step-by-step runs, stopping at 2-3 items and falsely reporting completion.
- 0:18 — Repeat task optimization finding (highlight): Writing a Playwright script once and running it 5 times with no agent involvement: 70 of 75 runs correct, ~2.5 seconds each, zero tokens per run. Only cost was one initial script write.
- 0:21 — Primary conclusion (narration): Tool choice (CLI vs MCP) matters less than the job design and agent strategy. Recommendations: have agents write scripts for static repeating tasks, give full tasks instead of tiny steps (especially for cheaper models), always verify results not just agent replies.
- 0:15 — GPT-6 Luna exhibits task halting with false completion on step-by-step instructions: 5 of 15 runs stopped at 2-3 items out of 8 but reported successful completion. Without explicit result verification, failures would appear as successes. (issue): Always verify actual task results or shop records rather than relying on agent replies. For Luna specifically, avoid step-by-step instruction patterns on multi-step tasks, or implement explicit completion validation.
- 0:13 — Step-by-step instruction pattern causes 6-27× token usage increase across all models and both CLI and MCP tools, without compensating benefits in speed or reliability. (issue): Instruct agents to perform complete tasks in one step rather than breaking into sequential sub-steps. Reserve step-by-step only when task decomposition is necessary for clarity.

## User Reported Feedback
- 0:06 — On Playwright docs task (narrator specified), Claude used ~60,000 tokens on both CLI and MCP. OpenAI Luna and Sol showed MCP using fewer tokens than CLI. (narration)
- 0:07 — On shop task (buy one item), CLI used 40-50% fewer tokens on Claude, 26-47% fewer on Luna. Sol showed no clear gap. (narration)
- 0:08 — MCP was as quick or quicker than CLI almost every time on speed measurements. (narration)
- 0:15 — GPT-6 Luna failed on 5 of 15 step-by-step runs (33% failure rate), stopping at 2-3 items out of 8 while incorrectly reporting completion. (narration)
- 0:19 — Each script rerun took approximately 2.5 seconds with zero tokens. (narration)
- 0:19 — Initial script writing cost roughly equivalent to one normal agent run in tokens. (narration)

## Direct Observations
- 0:01 — Initial usage dashboard shows 26% to 92% of 5-hour limit consumed, with one Playwright run labeled as 2,938,469 tokens across 51 browser calls. (visual)
- 0:02 — MCP architecture: every browser page snapshot and action returns to the conversation, increasing token context. (visual)
- 0:02 — CLI architecture: saves pages to file, agent reads only needed portions, reducing conversation token overhead. (visual)
- 0:04 — Benchmark shows 277 passed runs and 8 failed runs across 285 total tests. (visual)
- 0:11 — Luna with MCP and script-writing: 97K tokens, 3 calls. Luna with MCP clicking through: 2.9M tokens, 51 calls. (visual)
- 0:16 — Claude Sonnet 5.5 and GPT-6.1 Sol completed all step-by-step runs (25/25), while Luna only succeeded on 20/25. (visual)
- 0:18 — Repeat task test: 75 reruns of Playwright scripts (5 reruns × 15 scripts), 70 correct. All failures traced to one buggy script repeated 5 times. (visual)

## Suggested Changes
- 0:15 — Always verify actual task results or shop records rather than relying on agent replies. For Luna specifically, avoid step-by-step instruction patterns on multi-step tasks, or implement explicit completion validation. Rationale: GPT-6 Luna exhibits task halting with false completion on step-by-step instructions: 5 of 15 runs stopped at 2-3 items out of 8 but reported successful completion. Without explicit result verification, failures would appear as successes.
- 0:13 — Instruct agents to perform complete tasks in one step rather than breaking into sequential sub-steps. Reserve step-by-step only when task decomposition is necessary for clarity. Rationale: Step-by-step instruction pattern causes 6-27× token usage increase across all models and both CLI and MCP tools, without compensating benefits in speed or reliability.
- Consider: Model selection and agent strategy (script vs interactive) have larger token impact than CLI vs MCP tool choice. The 30× difference between script writing and interactive clicking dominates the 2.15× tool comparison.
- Consider: Task type determines optimal tool: static, repeating tasks favor pre-written scripts (zero tokens per rerun); dynamic or new pages favor CLI with shell file handling over MCP's full-page-in-conversation overhead.
- Consider: Cheaper models (GPT-6 Luna) are sensitive to instruction granularity: step-by-step patterns trigger both high token usage and reliability failures. More capable models (Claude, Sol) tolerate step-by-step but still consume 6-27× more tokens.
- Consider: Agent behavior is more controllable than tool selection for optimization: the same model+tool combination can vary by 30× based on whether the agent writes a script or clicks through interactively.
- Consider: Verification gap risk: Luna's false completion reports mean token cost alone cannot be trusted as success metric; explicit result inspection is required, especially on step-by-step runs.

## Context
- Type: recording
- Intended use: Portable share artifact for human or agent review.
- Capture mode: feedback-recording
- Primary URL: <https://youtu.be/7MiJN2htFtE>
- Available sections: context, evidence, analysis, summary, userReportedFeedback, directObservations, suggestedChanges, screenshots, transcript, video

## Agent Use
- Canonical entrypoint: <https://thinkrun.ai/s/Yt9Qk5rHtnCJckXku53Nfq-5uKxONQxcA9ufdndohgA.json>
- Recommended consumption order: canonical\_json -\> summary -\> userReportedFeedback -\> directObservations -\> suggestedChanges -\> analysis -\> screenshots -\> transcript -\> video

## Evidence
- Transcript available: yes
- Screenshots: 34
- Navigation entries: 0
- Console logs: 0
- Network requests: 0
- DOM snapshots: 0

## Artifact Inventory
- JSON bundle: linked at <https://thinkrun.ai/s/Yt9Qk5rHtnCJckXku53Nfq-5uKxONQxcA9ufdndohgA.json>
- Markdown artifact: linked at <https://thinkrun.ai/s/Yt9Qk5rHtnCJckXku53Nfq-5uKxONQxcA9ufdndohgA.md>
- Package export: linked at <https://thinkrun.ai/s/Yt9Qk5rHtnCJckXku53Nfq-5uKxONQxcA9ufdndohgA.bundle.zip>
- Video: linked at <https://thinkrun.ai/api/share/Yt9Qk5rHtnCJckXku53Nfq-5uKxONQxcA9ufdndohgA/video>
- Screenshots: inline list (34) in canonical JSON bundle
- Transcript: inline in canonical JSON bundle
- Navigation: absent
- Console logs: absent
- Network requests: absent
- DOM snapshots: absent

## Screenshots
- — — [A ThinkRun graphic asks whether Playwright is burning your limit and shows a usage card indicating 26% of a 5-hour limit has been used, w...](https://thinkrun.ai/api/share/Yt9Qk5rHtnCJckXku53Nfq-5uKxONQxcA9ufdndohgA/screenshots/a4c1c68d-b05d-47f4-be26-16257595a860)
- — — [A ThinkRun dashboard shows 92% of a 5-hour limit used, alongside a Playwright run with 51 browser calls and 0 tokens.](https://thinkrun.ai/api/share/Yt9Qk5rHtnCJckXku53Nfq-5uKxONQxcA9ufdndohgA/screenshots/c5311bea-ea08-43ec-b0e8-29b480f8bc48)
- — — [A ThinkRun graphic compares usage stats with the question “MCP or CLI?”](https://thinkrun.ai/api/share/Yt9Qk5rHtnCJckXku53Nfq-5uKxONQxcA9ufdndohgA/screenshots/8301df54-9b10-414a-8678-f04d650b6b15)
- — — [A presentation slide contrasts MCP with CLI, showing that under MCP every browser page returns to the conversation and increases the toke...](https://thinkrun.ai/api/share/Yt9Qk5rHtnCJckXku53Nfq-5uKxONQxcA9ufdndohgA/screenshots/e11bb3d4-fc84-4c1b-b6b7-38eba927d2cd)
- — — [An infographic compares MCP, where every page returns to the conversation and uses more tokens, with CLI, which saves a page to a file so...](https://thinkrun.ai/api/share/Yt9Qk5rHtnCJckXku53Nfq-5uKxONQxcA9ufdndohgA/screenshots/f721d23f-01ef-4b0d-81a7-109315de4453)
- — — [A ThinkRun graphic compares Playwright’s demo token usage for CLI and MCP, while leaving ThinkRun’s own results as a question mark.](https://thinkrun.ai/api/share/Yt9Qk5rHtnCJckXku53Nfq-5uKxONQxcA9ufdndohgA/screenshots/a0de270a-224b-4751-b284-fe67c702e590)
- — — [An infographic summarizes 285 benchmark runs, showing 277 passed and 8 failed across several task categories. A grid marks each run, with...](https://thinkrun.ai/api/share/Yt9Qk5rHtnCJckXku53Nfq-5uKxONQxcA9ufdndohgA/screenshots/cf5dc7de-0f81-4b1e-8a23-a624d7baab46)
- — — [An infographic summarizes a ThinkRun benchmark, showing 285 runs with 277 passed and 8 failed across four task types. It also names the m...](https://thinkrun.ai/api/share/Yt9Qk5rHtnCJckXku53Nfq-5uKxONQxcA9ufdndohgA/screenshots/b21e4062-3cce-4b61-b26c-8364a3deeb0d)
- — — [A ThinkRun benchmark slide summarizes 285 test runs, with 277 passed and 8 failed. It also shows task categories, model labels, and examp...](https://thinkrun.ai/api/share/Yt9Qk5rHtnCJckXku53Nfq-5uKxONQxcA9ufdndohgA/screenshots/01ed91bb-a6ac-45d9-a85d-33e19301eef0)
- — — [A ThinkRun slide titled “The surprise” shows a chart comparing token gaps by tool and model. The tool comparison has a bar labeled 2.15×,...](https://thinkrun.ai/api/share/Yt9Qk5rHtnCJckXku53Nfq-5uKxONQxcA9ufdndohgA/screenshots/21503339-a9cd-4011-9ca1-8484b18e8368)
- — — [A comparison graphic shows Playwright’s demo token counts for CLI and MCP on the left, alongside a panel for ThinkRun’s runs using Claude...](https://thinkrun.ai/api/share/Yt9Qk5rHtnCJckXku53Nfq-5uKxONQxcA9ufdndohgA/screenshots/93271e20-9580-47da-abf3-7f2227f474a1)
- — — [A chart compares token usage for three models across CLI and MCP + shell runs; only Claude Sonnet 5.5 has plotted results, with MCP + she...](https://thinkrun.ai/api/share/Yt9Qk5rHtnCJckXku53Nfq-5uKxONQxcA9ufdndohgA/screenshots/3583eae8-314f-4024-a9a2-d564d036bbed)
- — — [A chart compares token usage across CLI and MCP + shell runs for three models, with each dot representing one run. GPT 6 Luna shows the w...](https://thinkrun.ai/api/share/Yt9Qk5rHtnCJckXku53Nfq-5uKxONQxcA9ufdndohgA/screenshots/50f1c94e-bd84-4ab1-a389-4ef0f2497d34)
- — — [A dot plot compares token usage for CLI versus MCP + shell runs across Claude Sonnet 5.5, GPT 6 Luna, and GPT 6.1 Sol; for Claude, CLI us...](https://thinkrun.ai/api/share/Yt9Qk5rHtnCJckXku53Nfq-5uKxONQxcA9ufdndohgA/screenshots/7b3940b0-27ec-480d-bf5d-9aa61f85a3b9)
- — — [A ThinkRun chart compares token usage for Claude Sonnet 5.5, GPT 6 Luna, and GPT 6.1 Sol across CLI and MCP + shell runs. It highlights l...](https://thinkrun.ai/api/share/Yt9Qk5rHtnCJckXku53Nfq-5uKxONQxcA9ufdndohgA/screenshots/8bc79b80-e0d1-4c75-aebf-b399e05644af)
- — — [A benchmark chart compares token usage and speed for CLI versus MCP + shell across three AI models on a shop task. CLI uses fewer tokens...](https://thinkrun.ai/api/share/Yt9Qk5rHtnCJckXku53Nfq-5uKxONQxcA9ufdndohgA/screenshots/ae7ed63a-2df5-4160-ab1b-dfad8916dc09)
- — — [A presentation slide titled “The agent’s approach” outlines a task to search for eight products, add each, and report the total, comparin...](https://thinkrun.ai/api/share/Yt9Qk5rHtnCJckXku53Nfq-5uKxONQxcA9ufdndohgA/screenshots/39589ed7-e98a-4ccf-a25b-66c43dc30174)
- — — [An infographic compares two ways an AI agent handled the same eight-product task: writing a script used 97K tokens and 3 calls, while cli...](https://thinkrun.ai/api/share/Yt9Qk5rHtnCJckXku53Nfq-5uKxONQxcA9ufdndohgA/screenshots/006d2048-c419-4282-9fa8-dd26ea195880)
- — — [A ThinkRun benchmark graphic compares two approaches: writing a script took 97K tokens and 3 calls, while clicking through took 2.9M toke...](https://thinkrun.ai/api/share/Yt9Qk5rHtnCJckXku53Nfq-5uKxONQxcA9ufdndohgA/screenshots/488f293d-024f-4197-9943-ae06514aaf95)
- — — [A ThinkRun chart compares token usage for Claude, Luna, and Sol using CLI or MCP + shell, with each model instructed to act “one action a...](https://thinkrun.ai/api/share/Yt9Qk5rHtnCJckXku53Nfq-5uKxONQxcA9ufdndohgA/screenshots/a82e742a-3c5c-482c-9b48-8406782f1747)
- — — [An infographic compares token use for normal runs versus step-by-step runs across Claude, Luna, and Sol using CLI or MCP + shell. Every s...](https://thinkrun.ai/api/share/Yt9Qk5rHtnCJckXku53Nfq-5uKxONQxcA9ufdndohgA/screenshots/1b5ba174-404c-4ab6-8405-2207b88394bb)
- — — [A mostly blank ThinkRun benchmark screen shows three model labels—Luna, Claude, and Sol—along the bottom.](https://thinkrun.ai/api/share/Yt9Qk5rHtnCJckXku53Nfq-5uKxONQxcA9ufdndohgA/screenshots/32833a90-6cc0-490b-9f46-628b343a10b1)
- — — [A benchmark graphic compares Luna’s JSON order response with the shop’s recorded items, with scores shown for Luna, Claude, and Sol. Luna...](https://thinkrun.ai/api/share/Yt9Qk5rHtnCJckXku53Nfq-5uKxONQxcA9ufdndohgA/screenshots/adf344ee-d640-434e-ab29-44f876a63c46)
- — — [A ThinkRun graphic contrasts Luna’s completed JSON reply with a browser session showing what actually happened during a shopping-cart task.](https://thinkrun.ai/api/share/Yt9Qk5rHtnCJckXku53Nfq-5uKxONQxcA9ufdndohgA/screenshots/c1c44018-667d-4acd-b579-9e8d7b87d798)
- — — [A minimalist ThinkRun presentation slide asks why an agent should drive the browser. The ThinkRun logo appears in the upper-right corner,...](https://thinkrun.ai/api/share/Yt9Qk5rHtnCJckXku53Nfq-5uKxONQxcA9ufdndohgA/screenshots/56f9e98f-761f-434c-894e-e96db0ceeec5)
- — — [A benchmark slide compares three AI models on rerunning scripts, showing 46 of 75 runs correct overall. A terminal-style panel shows a sh...](https://thinkrun.ai/api/share/Yt9Qk5rHtnCJckXku53Nfq-5uKxONQxcA9ufdndohgA/screenshots/70cccc3c-7291-46f4-a34c-011bcaf3a0eb)
- — — [An infographic explains a “write it once” benchmark: one generated script is rerun repeatedly, with results shown for three AI models. Cl...](https://thinkrun.ai/api/share/Yt9Qk5rHtnCJckXku53Nfq-5uKxONQxcA9ufdndohgA/screenshots/1ee0b1b2-abda-4cab-b013-da511d94b5c0)
- — — [An infographic shows a repeat-job stability benchmark, with 70 of 75 reruns correct overall. Claude Sonnet 5.5 and GPT 6.1 Sol score 25/2...](https://thinkrun.ai/api/share/Yt9Qk5rHtnCJckXku53Nfq-5uKxONQxcA9ufdndohgA/screenshots/a6c945d6-15df-423b-81f6-4962214a90a7)
- — — [A benchmark graphic compares three AI models completing repeat scripts, showing 70 of 75 reruns correct; the left panel advises when to r...](https://thinkrun.ai/api/share/Yt9Qk5rHtnCJckXku53Nfq-5uKxONQxcA9ufdndohgA/screenshots/af6ca459-8561-4643-99e6-b849fed4315c)
- — — [A benchmark chart compares median token use for three models across CLI, MCP + shell, and agent-browser. It notes that agent-browser pass...](https://thinkrun.ai/api/share/Yt9Qk5rHtnCJckXku53Nfq-5uKxONQxcA9ufdndohgA/screenshots/6a47b191-d401-4d79-a798-762afb190fac)
- — — [A minimalist ThinkRun title slide displays a large headline in the upper left, with the ThinkRun logo in the upper right.](https://thinkrun.ai/api/share/Yt9Qk5rHtnCJckXku53Nfq-5uKxONQxcA9ufdndohgA/screenshots/3e1c3c19-6e74-4221-94b0-6e0d9ff02252)
- — — [A presentation slide emphasizes focusing on the job assigned to an agent rather than MCP or CLI. An empty two-column table appears below...](https://thinkrun.ai/api/share/Yt9Qk5rHtnCJckXku53Nfq-5uKxONQxcA9ufdndohgA/screenshots/c91f6afb-7ec1-459d-9947-a717b17f8df9)
- — — [A presentation slide argues that choosing an agent’s task matters more than whether it uses MCP or CLI, and gives guidance for different...](https://thinkrun.ai/api/share/Yt9Qk5rHtnCJckXku53Nfq-5uKxONQxcA9ufdndohgA/screenshots/8d3de19e-3be5-49e3-842e-bb8f9c3b5f74)
- — — [A ThinkRun presentation slide advises focusing on the task given to an agent rather than whether it uses MCP or CLI. A table suggests whe...](https://thinkrun.ai/api/share/Yt9Qk5rHtnCJckXku53Nfq-5uKxONQxcA9ufdndohgA/screenshots/660f13fd-6079-476d-9441-414563980fa1)

## Video
[Download video](https://thinkrun.ai/api/share/Yt9Qk5rHtnCJckXku53Nfq-5uKxONQxcA9ufdndohgA/video)

## Transcript
If you use a subscription for your coding agent, like Claw Code or Codex, you know what it's like to hit your five hour or weekly limit before you're done. And if your agent uses Playwright to test your work, its token usage can balloon. In this video, we're going to find the most efficient Playwright setup. Is it the MCP or is it the CLI? And the answer might surprise you. It surprised us. First, here's how the two differ. With MCP, your agent gets a set of browser tools and every page it reads comes back to the conversation. With the new Playwright CLI made for coding agents, your agent runs commands in a shell. So it can save a page to file and read only the part that it actually needs. And that's why you'll often read that the CLI uses fewer tokens. And Playwright's own demo showed it using about a quarter as many. And we wanted to know if that actually holds up. So we ran 285 tests on three models, Claude Sonnet 5.5 and OpenAI's GPT-6 Luna and GPT-6.1 Soul. We use two kinds of tasks. The first one is from Playwright's own demo video. Search for locators and screenshot the docs for languages And the second is a small test shop that we built where the agent adds items to the cart and the shop records what actually happened Here's the surprise. Which tool you picked actually mattered the least? The model mattered more and how the agent worked mattered most of all. And so let's go through what we found. On the docs task from the playwright demo video, Claude used about the same on both, about 60,000 tokens. On OpenAI's models, it went the other way from what we expected. The MCP used fewer tokens than the CLI, about half as many on Luna, about 15% fewer on Sol. And when we changed the task, it flipped. On the shop, buying one item, the CLI used about 40% to 50% fewer tokens on Claude and 26% to 47% fewer on Luna. And in Seoul, there was no real clear gap. So the CLI's advantage is real, but it depends on the model and the task. It wasn't faster, though. The MCP was as quick or quicker almost every time. Then we gave the agents a longer job. search the shop for eight products add each one to the cart and report the total Some agents wrote a short script and ran it On Luna with the MCP a run that wrote a script used 97 tokens and a run that clicked through used 2.9 million and 51 separate calls, but got the answer right. And that's 30 times more usage from how the agent actually worked. We tested that specifically on purpose. We ran an eight item job again and told the agents to take one action at a time with no scripts. Usage went up six to 27 times on every model and both tools. If your instructions tell your agent to take tiny steps, you might want to try it without them. Now, going step by step also tripped up Luna. The cheapest model we tested. Five of its 15 step-by-step runs stopped at two or three items out of eight and still replies as if they'd finished. Cloud and Sol finished every one of theirs. Without the Shopzone record, Luna's failure would actually have looked complete. So you have to check the result and not the reply. And that raises the question people ask a lot. Why have the agent drive the browser at all? We tested that too We asked each agent to write a playwright script for the eight item job once then ran each script five more times with no agent involved 70 of those 75 runs were right Each took about two and a half seconds and they used zero tokens. Writing the script costs no more than one normal run. And the misses all came from one script with a bug, which got the same thing wrong every time. So if a task repeats on a page that doesn't change at all, have your agent write the script once, check what it prints, and then just run it. Keep the agent driving for pages that actually change or that it hasn't seen before. And we also ran the same test with agent browser, which people also ask a lot. It passed every run, but it didn't consistently use fewer tokens in playwright. So what's the most efficient playwright setup? It's less about the MCP or the CLI and more about the job you actually give to the agent. It's your job as an engineer to know what the test actually needs and then tell your agent how to approach it. If the job repeats, have it write the script once. Give it the whole task, not in a long list of tiny steps, especially on a cheaper model and whatever you run, you must check the result or the output and not just the reply from the agent.

---
Source: https://thinkrun.ai/s/Yt9Qk5rHtnCJckXku53Nfq-5uKxONQxcA9ufdndohgA
Full JSON: https://thinkrun.ai/s/Yt9Qk5rHtnCJckXku53Nfq-5uKxONQxcA9ufdndohgA.json
