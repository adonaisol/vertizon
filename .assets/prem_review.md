# Anthropic Software Engineering Take-Home: Strategy & Execution Guide

---

## 1. Assignment Context & Evaluation Framework

### Overview
* **Role Focus:** Product and Application Software Engineering.
* **Format:** Open-ended prototype build designed to replace a synchronous technical interview before the virtual final onsite.
* **Time Budget:** Target **1–2 hours**; Hard limit **8 hours**.
* **Core Directive:** Build a functional prototype demonstrating an impressive, self-contained experience that showcases judgment, creativity, and execution.

### What Anthropic is Actually Evaluating
1. **Scoping Ability (Explicit Evaluation Metric):**
   * Anthropic explicitly values *depth and insight over breadth*. 
   * A razor-sharp implementation of **one** deeply considered interaction beats an expansive app with five shallow, half-finished features.
2. **Product Taste & Craft:**
   * High-quality ergonomics, thoughtful typography, intuitive visual hierarchy, and immediate feedback states (loading, streaming, empty, error).
   * Designing interfaces that avoid the industry-standard "slot machine" pattern (typing a prompt, hitting "Generate", getting a wall of text).
3. **Handling Complexity Gracefully:**
   * Clean separation between UI presentation, state management, and business logic.
   * Defensive handling of edge cases and resilient user flows.
4. **Self-Contained & Frictionless:**
   * Zero-friction setup: A single command to run locally (e.g., `npm install && npm run dev`), or ideally a hosted live demo URL.
   * Reviewers should be able to experience the app immediately without broken configurations.

---

## 2. Core Deliverables

1. **Functional Prototype / Codebase:**
   * Clean, modular, well-structured code.
   * Runs locally with zero friction (and preferably deployed to Vercel/Netlify for instant review).
2. **Written Design Rationale (`README.md` or dedicated doc):**
   * **Time Spent:** Clear and honest estimation (e.g., ~2.5 hours).
   * **Problem & Core Insight:** Why this specific problem matters and why the solution is non-obvious.
   * **Key Architectural Decisions & Trade-offs:** What technical choices were made and why.
   * **Intentional Scoping / Cuts:** Explicit documentation of what was left out to keep the build tight and deep.
   * **Future Work:** What would be built next with two more weeks.
3. **5-Minute Walkthrough Video (e.g., Loom):**
   * A concise screen recording showing the working prototype, demonstrating the key interaction, and explaining the design philosophy and trade-offs.

---

## 3. Technical & API Strategy (Claude Max vs. API Key)

* **The Reality:** A consumer/pro Claude Max subscription does not provide programmatic access via the Anthropic Console API (`console.anthropic.com`).
* **The Recommended Pattern: "Zero-Friction Default + BYOK"**
  * **Default (Mock Mode):** Ship the application with high-quality, pre-baked realistic fixtures and instant/simulated latency by default. This guarantees the reviewer's demo never breaks due to missing environment variables, network drops, or rate limits.
  * **Bring Your Own Key (BYOK):** Provide a subtle settings input where a reviewer (or you) can enter an Anthropic API key stored locally in `localStorage` to test live inference.
  * **Using Claude Max During Development:** Use your Claude Max subscription to pair-program, write tricky CSS/state logic, and generate realistic synthetic JSON datasets for your prototype.

---

## 4. The Two Relevant Themes & Project Concepts

### Theme 1: Exploration & Understanding
> *"Complex systems, technical concepts, and unfamiliar artifacts are hard to understand through static explanation. Build a tool that helps users develop deep understanding..."*

* **Inspiration:** *Distill.pub* (co-founded by Anthropic co-founder Chris Olah) and Bret Victor’s *Explorable Explanations*.
* **Concept: "The Explorable Context Window & Prompt Sandbox"**
  * **The Problem:** Developers and users struggle to build intuition around how LLM context windows fill up, how prompt caching saves 90% latency, and how long-context attention degrades.
  * **The Core Flow:** An interactive, scrubbable model where users manipulate sliders (System Prompt Size, Conversation Turns, Context Length) and toggle features (Prefix Caching On/Off).
  * **Visual Feedback:** A dynamic token memory map, a real-time Time-to-First-Token (TTFT) and cost curve, and preset "break-it" scenarios (e.g., "Needle in a Haystack Retrieval", "Cache Invalidation").
  * **Key Advantage:** Can be built as a 100% clientside deterministic simulation—zero external API dependencies, zero chance of live API failure, pure UI and state craft.

---

### Theme 2: Creative & Generative Tools
> *"Creative tools can unlock workflows that weren't previously possible. Build a tool that gives users meaningful creative leverage—not just 'generate' buttons, but real control over iteration, variation, and refinement."*

* **Inspiration:** Academic HCI research on steering interfaces and direct-manipulation generative tools.
* **Concept: "The Steering Dial & In-Situ Refinement Canvas"**
  * **The Problem:** Mainstream AI writing tools are all-or-nothing slot machines. Hitting "Regenerate" destroys good parts of text, and single-dimension prompts lack granular control.
  * **The Core Flow:** A block-based text editor where selecting any sentence or paragraph opens a multi-axial "Refinement HUD" (e.g., orthogonal sliders for *Directness*, *Technical Depth*, or *Conviction*).
  * **The Key Interaction:** Moving a slider displays a live word-level visual diff (insertions/deletions) and offers a lightweight "Fork / Branch" feature to explore two directions side-by-side without losing previous thoughts.
  * **Key Advantage:** Directly addresses Anthropic's stated frustration with "generate buttons" by providing genuine steering, branching, and micro-diffing.

---

## 5. Navigating Originality & The "Copycat" Concern

* **What Anthropic Disqualifies:**
  * Generic Chatbot Wrappers (a standard text input calling an LLM endpoint).
  * Generic CRUD dashboards (a basic table with search and filters).
  * Over-scoped, buggy clones of existing SaaS tools.
* **Where True Originality Comes From:**
  * In a 1–2 hour engineering challenge, originality is **not** about inventing an ungrounded scientific paradigm; it is about **interaction taste, ergonomic design, and intentional scoping**.
  * Picking a known interaction bottleneck (e.g., prompt slot machines or opaque token mechanics) and solving it with polish, smooth micro-interactions, and clear architectural boundaries is the primary signal evaluated.

---

## 6. Recommended Execution Timeline (Target: 2–3 Hours)

| Timeframe | Phase | Key Activities |
| :--- | :--- | :--- |
| **00:00 – 00:30** | **Scope Definition & Wireframing** | Pick one theme. Define the single "hero" interaction. Write down the state model and assemble realistic mock data. |
| **00:30 – 01:45** | **Core Build & State Management** | Scaffold with Next.js/Vite + Tailwind. Build the core component, implement state logic/diffs, and hook up the mock/BYOK data layer. |
| **01:45 – 02:15** | **Polish, Ergonomics & Edge Cases** | Add keyboard navigation, transitions, responsive empty/error states, and fine-tune typography and visual hierarchy. |
| **02:15 – 02:45** | **Documentation & Video Walkthrough** | Write the Design Rationale (`README.md`), deploy to a live URL (Vercel), and record the 5-minute Loom demo. |
