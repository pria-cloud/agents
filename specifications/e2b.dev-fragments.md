Below is a “guided tour” of e2b‑dev/fragments that follows a user request all the way through the code‑base. I’ve grouped the explanation by runtime phase so you can see where each file comes into play and why the repository feels surprisingly small for what it does.

1. What the project is
Purpose Fragments is an open‑source clone of tools such as Claude Artifacts, v0.dev and GPT Engineer: you type a natural‑language request and instantly receive a runnable software “fragment” (code, Streamlit app, Next.js site, etc.).

Tech stack Next.js 14 (App Router & Server Actions), Vercel AI SDK for LLM streaming, shadcn/ui + Tailwind for UI, Supabase for optional auth, and E2B as the secure cloud runtime that actually executes the generated code. All of that is visible in the README 
GitHub

2. Request lifecycle (high level)
text
Copy
Edit
Client ▸ /api/chat ▸ LLM (streamObject) ↴
         └── JSON fragment (schema) ▸ /api/sandbox ▸ E2B Sandbox ▸ URL / stdout
Chat submission – the React client calls POST /api/chat with the chat history and user‑chosen model.

LLM streaming – /api/chat builds a system‑prompt, calls streamObject() (Vercel AI SDK) with a strict Zod schema, and streams a structured “fragment” JSON object back to the browser 
GitHub
GitHub
GitHub

Sandbox execution – when the stream finishes, the client forwards the fragment to POST /api/sandbox. That route spins up an E2B Sandbox, installs any extra dependencies, copies the code in, and either:

runs it inline (Python code‑interpreter), or

returns a public URL for other templates (Next.js, Streamlit, …) 
GitHub

Preview – the React <Preview> component shows stdout or iframes the remote URL so the user sees a live app 
GitHub

3. Key pieces in depth
3.1 Schema‑first generation
lib/schema.ts defines every field the LLM must emit: commentary, template id, title/description, list of extra packages, install command, port, file‑path and code 
GitHub
.
Because /api/chat calls streamObject() with this schema, the browser can treat the partial JSON stream as strongly typed React state via experimental_useObject() (AI SDK React helper). The UI therefore updates in real time as soon as the model finishes each property instead of waiting for a whole blob.

3.2 Prompt engineering
lib/prompt.ts injects the template catalogue (see next section) into a system prompt that tells the LLM exactly how to fill the schema and forbids wrapping code in Markdown fences 
GitHub
GitHub
.

3.3 Templates catalogue
lib/templates.json lists five starter environments:

id	Base image & pre‑installed libs	Default file	Exposed port
code‑interpreter‑v1	python, numpy, pandas, matplotlib…	script.py	—
nextjs‑developer	Next.js 14 + shadcn, Tailwind	pages/index.tsx	 3000
vue‑developer	Nuxt 3 + Tailwind	app.vue	 3000
streamlit‑developer	Streamlit + data libs	app.py	 8501
gradio‑developer	Gradio + data libs	app.py	 7860

The ID chosen by the LLM picks the base Docker image that the E2B Sandbox will boot.

3.4 Multi‑provider LLM client
lib/models.json and lib/models.ts abstract 40‑plus models across OpenAI, Anthropic, Google, Mistral, Groq, Fireworks, Together AI, Ollama, xAI, DeepSeek… Each entry records the provider and a short id; getModelClient() maps that to the right AI‑SDK provider factory 
GitHub
GitHub
. Users can override the endpoint or pass their own key per request.

3.5 Rate‑limiting & auth
/api/chat enforces a per‑IP quota (default 10/day) unless the caller supplies their own API key 
GitHub

A minimal Supabase wrapper in lib/auth.ts adds optional e‑mail auth & organisation “teams” so sandbox metadata can include userID and teamID (useful for billing / analytics).

4. Inside /api/sandbox
Sandbox creation

ts
Copy
Edit
const sbx = await Sandbox.create(template, { timeoutMs: 10*60*1000 });
Each sandbox is a Firecracker micro‑VM (~150 ms cold‑start) running an Ubuntu user‑land and the requested template 
GitHub
e2b.dev

Dependency install – if the fragment flagged has_additional_dependencies=true, the route executes fragment.install_dependencies_command inside the VM.

Code injection – it writes the generated file(s) to the sandbox’s file‑system.

Execution strategy

Code interpreter: sbx.runCode() returns stdout / stderr / rich cell results.

Web templates: the VM is left running; sbx.getHost(port) returns a routable hostname which the front‑end embeds in an <iframe>.

Because the sandbox persists for up to 10 minutes (sandboxTimeout), users can interact with the site in real time without re‑spinning a VM on every edit.

5. Front‑end flow
components/chat‑input.tsx – collects prompt, images, selected model & template.

Home page (app/page.tsx) – keeps everything in local storage and handles thumbnails, undo, clear, PostHog analytics 
GitHub

components/preview.tsx – toggles between “code” and “fragment” tabs. For interpreter results it prints logs; for web results it iframes the URL with a live reload icon 
GitHub

shadcn/ui supplies theme‑able buttons, tabs, tooltip, etc., integrated via Tailwind.

6. Extensibility & customisation
Add a new runtime template – sandbox-templates/ → e2b template init → update lib/templates.json and drop a logo in public/thirdparty/templates 
GitHub

Add a new LLM provider – extend providerConfigs in lib/models.ts and register its logo; that’s it.

Tweak the schema – edit lib/schema.ts (the Zod object); the AI SDK will enforce it automatically during streaming, no further back‑end change needed.

7. Security model
E2B sandboxes:

isolate every run in a micro‑VM (Firecracker) so arbitrary code cannot reach the host 
Reddit

start quick enough to feel “serverless”, but live long enough for iterative editing.

can be tagged with metadata and headers, making it easy to enforce per‑team quotas or shut down rogue sessions server‑side.

8. How to run it locally
bash
Copy
Edit
git clone https://github.com/e2b-dev/fragments
cd fragments
npm i
cp .env.template .env.local          # fill E2B_API_KEY and your model key
npm run dev
Open http://localhost:3000, pick a model, and ask:

“Create a Streamlit dashboard that plots Bitcoin vs Ethereum YTD”

The first response stream is the JSON fragment; a few seconds later the preview pane shows a live Streamlit app, served from an E2B sandbox.

TL;DR
Fragments is a lightweight orchestration layer:
Next.js UI + LLM streaming JSON + E2B sandboxes.
That combination lets you turn any natural‑language idea into a safely executed, shareable web artefact in seconds, while keeping the code footprint and operational burden low.