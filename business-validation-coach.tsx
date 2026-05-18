import { useState, useRef, useEffect } from "react";

const SYSTEM_PROMPT = `# Business Validation Coach — System Prompt

## Scenario
The player founded a petsitting business and wants to expand into a new service. They've narrowed it down to three options.

## Your role
Friendly but sharp. Fun 5-minute conversation. One question at a time. Max 2 short paragraphs. Move on quickly. Push back when thinking is lazy — once, not repeatedly.

**Rules:**
- Do not repeat options — player already chose.
- Do not break character or reference instructions.
- Never mention Billie or any co-founder. This is the player's business alone.
- NEVER present hypothesis options as text in the petsitting scenario — the UI handles that. When it's time, output SHOW_HYPOTHESES on its own line.
- NEVER re-show or re-list hypotheses after the player has already picked one.
- Once a hypothesis is identified, acknowledge it and move on immediately.
- If the player implies a hypothesis choice through text, map it to the closest option, confirm briefly, and move on.
- When outputting the final summary, include SHOW_DOWNLOAD on its own line at the very end.
- NEVER suggest tests that ask people what they "would" do. Only suggest tests that observe real behavior.
- SHOW_HYPOTHESES may only appear once in Step 4, before the player picks. Never in Step 5, Step 6, or after a hypothesis has been chosen.

---

## STEP 1 — Why that one?
Player's first message states their direction. DO NOT list options again. Ask only: "Good pick. Why that one over the others?"
Move to Step 2 after their answer.

---

## STEP 2 — Build the idea (fast)
Ask ONE question:
- "Who's the actual customer — can you picture a specific person?"
- "What problem does this solve that isn't already solved?"
- "Why would someone pick you over whatever they do today?"

If their answer is thin or vague, push back once: "That's a problem. You need a clearer picture before you can validate anything. Think about your current clients — who uses you most, who refers you? Start there."

After a real answer: one-sentence summary + one grounding insight. Move to Step 3.

---

## STEP 3 — Assumptions check
Ask: "How much of what you just told me do you actually know vs. assuming?"

- If mostly guessing: "Good — that's honest. Talk to 2–3 of your current clients before committing. Ask what they've done in the past, what's frustrated them, what they've already tried. Don't lead them — they'll tell you what's missing on their own."
- If overconfident: "I'd push back — most of what feels obvious at this stage turns out to be assumption. Which parts are you actually certain about?"

Move to Step 4.

---

## STEP 4 — The killer assumption (petsitting scenario)
Say: "Okay. Before those conversations, let's get clear on what you're actually trying to find out. Here are four assumptions about your idea — if one turns out to be wrong, which one kills the whole thing?"
Output on its own line: SHOW_HYPOTHESES

If they pick the untestable one, say: "That one only shows up in long-term data after you already have customers — you can't test it now. What you need is something you can get a signal on in 24–48 hours. Which of the others feels most critical?"
Then output SHOW_HYPOTHESES again.

After they pick a testable one: affirm in 1 sentence, explain briefly why it's the right one. Move to Step 5. Do NOT output SHOW_HYPOTHESES — the player has already chosen.

**Untestable hypotheses:**
- Pet insurance: d) retention — requires months of post-launch data
- Grooming: d) groomer quality consistency — only visible after months of working together
- Daycare: d) managing incidents — requires actually running the service

---

## STEP 5 — Test it
Say: "So — after those client conversations, you'll have early signal on whether [assumption] holds. But conversations give you opinions, not proof. A real test observes what people actually do when something concrete is in front of them — not what they say they'd do. What kind of test could you run in 24 hours?"
If the chosen hypothesis is about a partner rather than clients (grooming: b; insurance: c), add one sentence before the behavioral test question: "Since your hypothesis is about the [grooming partner / insurer], your most important conversation at this stage is actually with potential [groomers / insurers] — not clients. Bring something concrete: rough terms, what you'd expect from them, what they'd get in return. See how they respond."

Never suggest asking what people "would" do. Only behavioral tests:
- One-pager with a real price sent to clients — count who replies or tries to book
- "Coming soon" in a booking confirmation — count who responds
- Fake booking link or waitlist form — count who fills it in
- Short video sent to clients — count who asks how to book

If they say "ask people if they'd use it": "That's asking for opinions. You want to observe behavior — put something real in front of them and see if they act."

Once they land on something behavioral: "That works. Do that this week." Move to Step 6.

---

## STEP 6 — Summary
Output exactly:

---
**Your validation snapshot — [direction]**

**The idea:** [one sentence]
**Your target customer:** [one phrase]
**The assumption that matters most:** [one sentence]
**The one question to answer before you commit:** [one sharp question]
---
SHOW_DOWNLOAD

---

## CUSTOM IDEA PATH
If first message is "my idea": "Great — tell me about it. What's the idea?"
Let them describe freely. Do not assume expansion or existing business.
Run steps 2–6 adapted to their idea.

For Step 4 in the custom path: generate 3 specific testable hypotheses based on their idea, plus 1 untestable one (something that only shows up post-launch — retention, long-term behaviour change, consistency over time, etc.). Then output SHOW_CUSTOM_HYPOTHESES (never SHOW_HYPOTHESES) followed by a JSON array on the next line in this exact format:
["Hypothesis one text","Hypothesis two text","Hypothesis three text","Hypothesis four text (untestable — label it clearly)"]

The fourth hypothesis must be the untestable one. Keep each under 12 words. Make them specific to their idea.

Apply same untestable redirect logic as above.

---

## Tone
Warm, fast, occasionally dry. Push back when lazy — once, clearly, then move on. Fun 5-minute conversation, not a workshop.`;

const HYPOTHESES = {
  insurance: [
    { id: "a", text: "a) Clients want insurance and don't already have it" },
    { id: "b", text: "b) Owners will trust a pet-sitter to handle their insurance" },
    { id: "c", text: "c) The insurer will offer us a margin worth building around" },
    { id: "d", text: "d) Offering insurance will meaningfully increase client retention", untestable: true },
  ],
  grooming: [
    { id: "a", text: "a) Clients want a combined sitting + grooming package" },
    { id: "b", text: "b) A grooming partner will commit to terms that work for both" },
    { id: "c", text: "c) Clients will pay a premium to book grooming together with pet sitting" },
    { id: "d", text: "d) The groomer's quality will stay consistent enough to stake our rep on", untestable: true },
  ],
  daycare: [
    { id: "a", text: "a) There's enough consistent demand in our area to fill slots" },
    { id: "b", text: "b) Dog owners are comfortable with their dog in a group setting" },
    { id: "c", text: "c) Occasional customers will book more sessions if we offer group options" },
    { id: "d", text: "d) We can manage 4–5 dogs without more incidents or stress", untestable: true },
  ],
  custom: [],
};

const OPTIONS = [
  { id: "insurance", label: "Pet insurance", desc: "Partner with an insurer, bundle coverage for your clients" },
  { id: "grooming", label: "Grooming partnership", desc: "Team up with a groomer, offer sitting + grooming packages" },
  { id: "daycare", label: "Group daycare", desc: "Launch a group daycare for 4–5 dogs at a time" },
];

const teal50 = "#E1F5EE", teal600 = "#0F6E56", teal800 = "#085041";
const amber50 = "#FAEEDA", amber700 = "#633806";
const purple600 = "#534AB7";

const TOOLS = [
  { emoji: "💬", name: "WhatsApp / iMessage", use: "Send a one-pager or 'coming soon' to 10 clients. Count replies." },
  { emoji: "📋", name: "Tally or Typeform", use: "Build a one-question waitlist form in 10 minutes. Share the link." },
  { emoji: "🎬", name: "Loom or CapCut", use: "Record a 60-second video of the concept. Watch how people react." },
  { emoji: "🔗", name: "Carrd or Notion", use: "Fake landing page with a price and a 'Book now' button. See who clicks." },
  { emoji: "🤖", name: "Claude or ChatGPT", use: "Draft your one-pager, client message, or video script in minutes." },
  { emoji: "📊", name: "Google Sheets", use: "Track who you contacted, what you sent, and what they did." },
];

const DOG_SVG = `<svg viewBox="0 0 340 110" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="50" cy="100" rx="22" ry="5" fill="#C0DD97"/>
  <rect x="32" y="78" width="8" height="18" rx="4" fill="#EF9F27"/>
  <rect x="60" y="78" width="8" height="18" rx="4" fill="#EF9F27"/>
  <ellipse cx="50" cy="70" rx="20" ry="17" fill="#FAC775"/>
  <ellipse cx="50" cy="57" rx="15" ry="14" fill="#FAC775"/>
  <ellipse cx="37" cy="46" rx="7" ry="10" fill="#EF9F27" transform="rotate(-15 37 46)"/>
  <ellipse cx="63" cy="46" rx="7" ry="10" fill="#EF9F27" transform="rotate(15 63 46)"/>
  <ellipse cx="44" cy="60" rx="3" ry="3" fill="#2C2C2A"/>
  <ellipse cx="56" cy="60" rx="3" ry="3" fill="#2C2C2A"/>
  <ellipse cx="45" cy="59" rx="1.2" ry="1.2" fill="white"/>
  <ellipse cx="57" cy="59" rx="1.2" ry="1.2" fill="white"/>
  <ellipse cx="50" cy="66" rx="5" ry="4" fill="#D85A30"/>
  <ellipse cx="50" cy="67" rx="3.5" ry="2.5" fill="#F09595"/>
  <path d="M46 66 Q50 70 54 66" stroke="#993C1D" stroke-width="0.8" fill="none"/>
  <ellipse cx="140" cy="100" rx="22" ry="5" fill="#C0DD97"/>
  <rect x="122" y="78" width="8" height="18" rx="4" fill="#CECBF6"/>
  <rect x="150" y="78" width="8" height="18" rx="4" fill="#CECBF6"/>
  <path d="M155 72 Q168 62 164 52 Q158 62 150 57" fill="#AFA9EC" stroke="none"/>
  <ellipse cx="140" cy="68" rx="20" ry="17" fill="#EEEDFE"/>
  <ellipse cx="140" cy="55" rx="15" ry="14" fill="#EEEDFE"/>
  <polygon points="127,44 122,26 135,40" fill="#AFA9EC"/>
  <polygon points="153,44 158,26 145,40" fill="#AFA9EC"/>
  <polygon points="128,43 123,29 135,40" fill="#CECBF6"/>
  <polygon points="152,43 157,29 145,40" fill="#CECBF6"/>
  <ellipse cx="134" cy="57" rx="3.5" ry="3.5" fill="#26215C"/>
  <ellipse cx="146" cy="57" rx="3.5" ry="3.5" fill="#26215C"/>
  <ellipse cx="135" cy="56" rx="1.2" ry="1.2" fill="white"/>
  <ellipse cx="147" cy="56" rx="1.2" ry="1.2" fill="white"/>
  <ellipse cx="140" cy="63" rx="4" ry="3" fill="#F4C0D1"/>
  <line x1="124" y1="62" x2="137" y2="63.5" stroke="#AFA9EC" stroke-width="0.8"/>
  <line x1="156" y1="62" x2="143" y2="63.5" stroke="#AFA9EC" stroke-width="0.8"/>
  <ellipse cx="230" cy="100" rx="20" ry="5" fill="#C0DD97"/>
  <rect x="214" y="80" width="7" height="16" rx="3.5" fill="#D3D1C7"/>
  <rect x="239" y="80" width="7" height="16" rx="3.5" fill="#D3D1C7"/>
  <path d="M248 85 Q264 78 258 95 Q250 85 244 90" fill="#B4B2A9" stroke="none"/>
  <ellipse cx="230" cy="72" rx="18" ry="15" fill="#E8E6DE"/>
  <ellipse cx="230" cy="60" rx="14" ry="13" fill="#E8E6DE"/>
  <ellipse cx="220" cy="48" rx="6" ry="9" fill="#D3D1C7" transform="rotate(-10 220 48)"/>
  <ellipse cx="240" cy="48" rx="6" ry="9" fill="#D3D1C7" transform="rotate(10 240 48)"/>
  <ellipse cx="220" cy="48" rx="4" ry="6" fill="#F4C0D1" transform="rotate(-10 220 48)"/>
  <ellipse cx="240" cy="48" rx="4" ry="6" fill="#F4C0D1" transform="rotate(10 240 48)"/>
  <ellipse cx="225" cy="62" rx="3" ry="3" fill="#2C2C2A"/>
  <ellipse cx="235" cy="62" rx="3" ry="3" fill="#2C2C2A"/>
  <ellipse cx="226" cy="61" rx="1.1" ry="1.1" fill="white"/>
  <ellipse cx="236" cy="61" rx="1.1" ry="1.1" fill="white"/>
  <ellipse cx="230" cy="68" rx="4" ry="3" fill="#E24B4A"/>
  <ellipse cx="230" cy="69" rx="3" ry="2" fill="#F09595"/>
  <ellipse cx="310" cy="100" rx="22" ry="5" fill="#C0DD97"/>
  <rect x="293" y="80" width="8" height="18" rx="4" fill="#FAC775"/>
  <rect x="319" y="80" width="8" height="18" rx="4" fill="#FAC775"/>
  <ellipse cx="310" cy="72" rx="20" ry="17" fill="#FAC775"/>
  <ellipse cx="310" cy="58" rx="15" ry="14" fill="#FAC775"/>
  <ellipse cx="303" cy="32" rx="5" ry="16" fill="#FAC775" transform="rotate(-5 303 32)"/>
  <ellipse cx="317" cy="32" rx="5" ry="16" fill="#FAC775" transform="rotate(5 317 32)"/>
  <ellipse cx="303" cy="32" rx="3" ry="12" fill="#F4C0D1" transform="rotate(-5 303 32)"/>
  <ellipse cx="317" cy="32" rx="3" ry="12" fill="#F4C0D1" transform="rotate(5 317 32)"/>
  <ellipse cx="304" cy="60" rx="3" ry="3" fill="#2C2C2A"/>
  <ellipse cx="316" cy="60" rx="3" ry="3" fill="#2C2C2A"/>
  <ellipse cx="305" cy="59" rx="1.2" ry="1.2" fill="white"/>
  <ellipse cx="317" cy="59" rx="1.2" ry="1.2" fill="white"/>
  <ellipse cx="310" cy="66" rx="4" ry="3" fill="#E24B4A"/>
  <ellipse cx="310" cy="67" rx="3" ry="2" fill="#F09595"/>
  <path d="M306 66 Q310 70 314 66" stroke="#993C1D" stroke-width="0.8" fill="none"/>
</svg>`;

const PAWPRINT_SVG = `<svg viewBox="0 0 120 100" xmlns="http://www.w3.org/2000/svg"><ellipse cx="60" cy="62" rx="22" ry="18" fill="#FAC775"/><ellipse cx="38" cy="44" rx="10" ry="13" fill="#FAC775"/><ellipse cx="82" cy="44" rx="10" ry="13" fill="#FAC775"/><ellipse cx="50" cy="34" rx="8" ry="11" fill="#FAC775"/><ellipse cx="70" cy="34" rx="8" ry="11" fill="#FAC775"/><ellipse cx="60" cy="62" rx="14" ry="12" fill="#EF9F27"/><ellipse cx="38" cy="44" rx="6" ry="8" fill="#EF9F27"/><ellipse cx="82" cy="44" rx="6" ry="8" fill="#EF9F27"/><ellipse cx="50" cy="34" rx="5" ry="7" fill="#EF9F27"/><ellipse cx="70" cy="34" rx="5" ry="7" fill="#EF9F27"/></svg>`;
const AVATAR_SVG = `<svg viewBox="0 0 120 100" xmlns="http://www.w3.org/2000/svg"><ellipse cx="60" cy="88" rx="28" ry="6" fill="#C0DD97"/><rect x="38" y="68" width="10" height="22" rx="5" fill="#EF9F27"/><rect x="72" y="68" width="10" height="22" rx="5" fill="#EF9F27"/><ellipse cx="60" cy="60" rx="26" ry="22" fill="#FAC775"/><ellipse cx="60" cy="46" rx="20" ry="18" fill="#FAC775"/><ellipse cx="42" cy="34" rx="9" ry="13" fill="#EF9F27" transform="rotate(-15 42 34)"/><ellipse cx="78" cy="34" rx="9" ry="13" fill="#EF9F27" transform="rotate(15 78 34)"/><ellipse cx="53" cy="50" rx="4" ry="4" fill="#2C2C2A"/><ellipse cx="67" cy="50" rx="4" ry="4" fill="#2C2C2A"/><ellipse cx="54" cy="49" rx="1.5" ry="1.5" fill="white"/><ellipse cx="68" cy="49" rx="1.5" ry="1.5" fill="white"/><ellipse cx="60" cy="57" rx="7" ry="5" fill="#D85A30"/><ellipse cx="60" cy="58" rx="5" ry="3" fill="#F09595"/><path d="M53 57 Q60 62 67 57" stroke="#993C1D" stroke-width="1" fill="none"/></svg>`;

const Avatar = ({ size = 30 }) => (
  <div style={{ width: size, height: size, borderRadius: "50%", background: teal50, flexShrink: 0, overflow: "hidden", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
    <div dangerouslySetInnerHTML={{ __html: AVATAR_SVG }} style={{ width: size * 1.55, height: size * 1.35, marginBottom: -3 }} />
  </div>
);

const inl = (t) => t.split(/(\*\*[^*]+\*\*)/).map((p, i) =>
  p.startsWith("**") && p.endsWith("**") ? <strong key={i} style={{ fontWeight: 500 }}>{p.slice(2, -2)}</strong> : p
);

const renderText = (text, isUser) => text.split("\n").map((line, i) => {
  if (line.startsWith("- ")) return <li key={i} style={{ marginLeft: 14, marginBottom: 3, fontSize: 14 }}>{inl(line.slice(2))}</li>;
  if (line.trim() === "---") return <hr key={i} style={{ border: "none", borderTop: `0.5px solid ${isUser ? "rgba(255,255,255,0.25)" : "#ddd"}`, margin: "8px 0" }} />;
  if (line.trim() === "") return <span key={i} style={{ display: "block", height: 5 }} />;
  return <p key={i} style={{ margin: "2px 0", fontSize: 14, lineHeight: 1.6 }}>{inl(line)}</p>;
});

function HypoButtons({ options, onPick, onOther }) {
  const [picked, setPicked] = useState(null);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingLeft: 38 }}>
      <p style={{ fontSize: 13, color: "#666", margin: "0 0 4px 4px" }}>Which one kills the idea if it's wrong?</p>
      {options.map((h) => {
        const isSel = picked === h.id;
        return (
          <button key={h.id} onClick={() => { setPicked(h.id); onPick(h); }}
            style={{ textAlign: "left", padding: "11px 16px", borderRadius: 14, fontSize: 14, cursor: "pointer", lineHeight: 1.5, border: isSel ? `2px solid ${teal600}` : "1px solid #ddd", background: isSel ? teal50 : "white", color: isSel ? teal800 : "#222", fontWeight: isSel ? 500 : 400 }}>
            {h.text}
          </button>
        );
      })}
      {onOther && (
        <button onClick={onOther}
          style={{ textAlign: "left", padding: "11px 16px", borderRadius: 14, fontSize: 14, cursor: "pointer", lineHeight: 1.5, border: "1px dashed #ccc", background: "transparent", color: "#888" }}>
          Something else →
        </button>
      )}
    </div>
  );
}

function DownloadScreen({ snapshot, onRestart }) {
  const steps = [
    { n: "1", title: "Talk to 2–3 real clients", desc: "Not a survey — a real conversation. Ask what they've done in the past, what's been frustrating, what they've already tried. Don't lead them. They'll tell you what's missing on their own." },
    { n: "2", title: "Listen for evidence on your assumption", desc: "You already identified the assumption that could sink the idea. Use the conversations to get early signal on whether it holds — before you build anything." },
    { n: "3", title: "Run a 24-hour behavioral test", desc: "Put something real in front of people and observe what they do. A reply, a click, an attempt to book = real signal. 'Sounds great!' is not." },
    { n: "4", title: "Count actions, not opinions", desc: "One-pager with a price. A 'coming soon' in a booking confirmation. A fake booking link. Cheap, fast, concrete." },
    { n: "5", title: "Decide with evidence", desc: "You now have a snapshot and a test result. That's a real decision, not a guess." },
  ];
  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "1.5rem" }}>
      {snapshot && (
        <div style={{ background: teal50, borderRadius: 16, padding: "1.2rem 1.4rem", marginBottom: 20, border: "1px solid #9FE1CB" }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, color: teal600, textTransform: "uppercase", marginBottom: 10 }}>Your validation snapshot</div>
          <div style={{ fontSize: 14, lineHeight: 1.7 }}>{renderText(snapshot, false)}</div>
        </div>
      )}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#666", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 12 }}>Your validation plan</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {steps.map(s => (
            <div key={s.n} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div style={{ width: 26, height: 26, borderRadius: "50%", background: teal600, color: "white", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>{s.n}</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 2 }}>{s.title}</div>
                <div style={{ fontSize: 13, color: "#666", lineHeight: 1.6 }}>{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#666", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 12 }}>Tools to do it fast</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {TOOLS.map(t => (
            <div key={t.name} style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #eee", background: "white" }}>
              <div style={{ fontSize: 18, marginBottom: 4 }}>{t.emoji}</div>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>{t.name}</div>
              <div style={{ fontSize: 12, color: "#666", lineHeight: 1.5 }}>{t.use}</div>
            </div>
          ))}
        </div>
      </div>
      <a href="NOTION_PUBLISH_URL" target="_blank" rel="noreferrer"
        style={{ display: "block", width: "100%", padding: "12px 0", fontSize: 15, fontWeight: 500, cursor: "pointer", borderRadius: 40, border: "none", background: teal600, color: "white", textAlign: "center", textDecoration: "none", boxSizing: "border-box", marginBottom: 12 }}>
        Read the full validation guide →
      </a>
      <button onClick={onRestart} style={{ width: "100%", padding: "12px 0", fontSize: 15, fontWeight: 500, cursor: "pointer", borderRadius: 40, border: `1.5px solid ${teal600}`, background: "transparent", color: teal600 }}>
        Try with my own idea →
      </button>
    </div>
  );
}

export default function App() {
  const [screen, setScreen] = useState("intro");
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [hypoInstances, setHypoInstances] = useState([]);
  const [showSummaryPrompt, setShowSummaryPrompt] = useState(false);
  const [snapshot, setSnapshot] = useState("");
  const choiceRef = useRef(null);
  const bottomRef = useRef(null);
  const hypoChosenRef = useRef(false);
  const untestablePickedRef = useRef(false);
  const pendingCustomRef = useRef(false);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading, hypoInstances, showSummaryPrompt]);

  useEffect(() => {
    if (screen === "intro" && pendingCustomRef.current) {
      pendingCustomRef.current = false;
      startChat("custom");
    }
  }, [screen]);

  const callAPI = async (msgs) => {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 600, system: SYSTEM_PROMPT, messages: msgs }),
    });
    const data = await res.json();
    return data.content?.find(b => b.type === "text")?.text || "";
  };

  const parseCustomHypos = (text) => {
    try {
      const match = text.match(/SHOW_CUSTOM_HYPOTHESES\s*(\[[\s\S]*?\])/);
      if (!match) return null;
      const arr = JSON.parse(match[1]);
      return arr.map((t, i) => ({ id: String(i), text: t, untestable: i === arr.length - 1 }));
    } catch { return null; }
  };

  const processResponse = (text, currentMessages) => {
    const hasCustomHypo = text.includes("SHOW_CUSTOM_HYPOTHESES");
    const hasHypo = !hasCustomHypo && text.includes("SHOW_HYPOTHESES");
    const hasDownload = text.includes("SHOW_DOWNLOAD");

    const cleaned = text
      .replace(/SHOW_CUSTOM_HYPOTHESES\n\[[\s\S]*?\]/g, "")
      .replace(/SHOW_HYPOTHESES/g, "")
      .replace("SHOW_DOWNLOAD", "")
      .trim();

    if (hasDownload) {
      const match = cleaned.match(/---\n([\s\S]+?)\n---/);
      if (match) setSnapshot(match[1].trim());
      setShowSummaryPrompt(true);
    }

    const newMsgIndex = currentMessages.filter(m => !m.hidden).length;
    setMessages(p => [...p, { role: "assistant", content: cleaned }]);

    if (hasHypo && !hypoChosenRef.current) {
      const allOpts = HYPOTHESES[choiceRef.current] || [];
      const opts = untestablePickedRef.current ? allOpts.filter(o => !o.untestable) : allOpts;
      setHypoInstances(p => [...p, { id: Date.now(), options: opts, done: false, isCustom: false, msgIndex: newMsgIndex }]);
    }
    if (hasCustomHypo && !hypoChosenRef.current) {
      const opts = parseCustomHypos(text);
      if (opts) setHypoInstances(p => [...p, { id: Date.now(), options: opts, done: false, isCustom: true, msgIndex: newMsgIndex }]);
    }
  };

  const startChat = async (choice) => {
    setScreen("chat");
    setLoading(true);
    choiceRef.current = choice;
    const firstMsg = choice === "custom" ? "my idea" : `I chose: ${OPTIONS.find(o => o.id === choice)?.label}`;
    try {
      const text = await callAPI([{ role: "user", content: firstMsg }]);
      const initMessages = [{ role: "user", content: firstMsg, hidden: true }];
      setMessages(initMessages);
      processResponse(text, initMessages);
    } catch { setMessages([{ role: "assistant", content: "Something went wrong. Try refreshing." }]); }
    setLoading(false);
  };

  const send = async (overrideContent, displayContent) => {
    const txt = (overrideContent || input).trim();
    if (!txt || loading) return;
    const userMsg = { role: "user", content: txt, display: displayContent || txt };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const apiMsgs = next.map(m => ({ role: m.role, content: m.content }));
      const text = await callAPI(apiMsgs);
      processResponse(text, next);
    } catch { setMessages(p => [...p, { role: "assistant", content: "Something went wrong." }]); }
    setLoading(false);
  };

  const pickHypo = (instanceId, hypo) => {
    setHypoInstances(p => p.map(h => h.id === instanceId ? { ...h, done: true, picked: hypo.id } : h));
    if (!hypo.untestable) hypoChosenRef.current = true;
    if (hypo.untestable) untestablePickedRef.current = true;
    send(`I pick: ${hypo.text}`, hypo.text);
  };

  const handleOther = (instanceId) => {
    setHypoInstances(p => p.map(h => h.id === instanceId ? { ...h, done: true } : h));
    send("None of those feel quite right — can you suggest something else?", "Something else →");
  };

  const handleKey = e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } };

  const restart = () => {
    setScreen("intro");
    setMessages([]);
    setSelected(null);
    setHypoInstances([]);
    setShowSummaryPrompt(false);
    setSnapshot("");
    choiceRef.current = null;
    hypoChosenRef.current = false;
    untestablePickedRef.current = false;
  };

  if (screen === "download") return (
    <DownloadScreen
      snapshot={snapshot}
      onRestart={() => { pendingCustomRef.current = true; restart(); }}
    />
  );

  if (screen === "intro") return (
    <div style={{ maxWidth: 460, margin: "0 auto", padding: "2rem 1.5rem", display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
      <div style={{ background: teal50, borderRadius: 20, width: "100%", display: "flex", justifyContent: "center", padding: "1.5rem 0 0.5rem" }}>
        <div dangerouslySetInnerHTML={{ __html: DOG_SVG }} style={{ width: "100%", maxWidth: 340, height: 110 }} />
      </div>
      <h1 style={{ fontSize: 24, fontWeight: 500, margin: 0, textAlign: "center" }}>Validate your next move</h1>
      <p style={{ fontSize: 15, color: "#666", lineHeight: 1.7, textAlign: "center", margin: 0 }}>
        You're ready to expand your petsitting business. In 5 minutes, we'll develop your next big idea and help you test it right away.
      </p>
      <div style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
        {["5 min", "Personalised", "Action-ready"].map(tag => (
          <span key={tag} style={{ background: teal50, color: teal800, fontSize: 12, fontWeight: 500, padding: "4px 12px", borderRadius: 20 }}>{tag}</span>
        ))}
      </div>
      <button onClick={() => setScreen("context")} style={{ marginTop: 4, padding: "12px 0", fontSize: 15, fontWeight: 500, cursor: "pointer", borderRadius: 40, border: "none", background: teal600, color: "white", width: "100%" }}>
        Let's go →
      </button>
      <button onClick={() => startChat("custom")} style={{ padding: "12px 0", fontSize: 15, fontWeight: 500, cursor: "pointer", borderRadius: 40, border: `1.5px solid ${teal600}`, background: "transparent", color: teal600, width: "100%" }}>
        I have my own business idea →
      </button>
    </div>
  );

  if (screen === "context") return (
    <div style={{ maxWidth: 460, margin: "0 auto", padding: "1.5rem", display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ background: amber50, borderRadius: 20, width: "100%", display: "flex", justifyContent: "center", padding: "1.5rem 0 0.5rem" }}>
        <div dangerouslySetInnerHTML={{ __html: PAWPRINT_SVG }} style={{ width: 110, height: 92 }} />
      </div>
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 500, margin: "0 0 12px" }}>The situation</h2>
        <p style={{ fontSize: 15, color: "#666", lineHeight: 1.75, margin: "0 0 12px" }}>
          You founded <strong style={{ color: "#222" }}>Pawsome Sitters</strong> two years ago. Business is steady — loyal clients, good reviews, reliable word-of-mouth.
        </p>
        <p style={{ fontSize: 15, color: "#666", lineHeight: 1.75, margin: "0 0 12px" }}>
          But growth has plateaued. Revenue is flat and you know you're leaving money on the table. You want to expand into a new service — something that uses what you already have: trusted relationships with pet owners, knowledge of their animals, and a reputation for care.
        </p>
        <p style={{ fontSize: 15, color: "#666", lineHeight: 1.75, margin: 0 }}>
          You've done some research and narrowed it down to <strong style={{ color: "#222" }}>three options</strong>. Now you need to figure out which one is actually worth pursuing — and how to find out fast.
        </p>
      </div>
      <button onClick={() => setScreen("pick")} style={{ padding: "12px 0", fontSize: 15, fontWeight: 500, cursor: "pointer", borderRadius: 40, border: "none", background: teal600, color: "white", width: "100%" }}>
        See the options →
      </button>
    </div>
  );
  if (screen === "pick") return (
    <div style={{ maxWidth: 460, margin: "0 auto", padding: "1.5rem", display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ background: "#FAEEDA", borderRadius: 20, width: "100%", display: "flex", justifyContent: "center", padding: "1.5rem 0 0.5rem" }}>
        <div dangerouslySetInnerHTML={{ __html: PAWPRINT_SVG }} style={{ width: 110, height: 92 }} />
      </div>
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 500, margin: "0 0 4px" }}>Pick a direction</h2>
        <p style={{ fontSize: 14, color: "#666", margin: 0 }}>Which option do you want to investigate?</p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {OPTIONS.map(o => {
          const sel = selected === o.id;
          return (
            <div key={o.id} onClick={() => setSelected(o.id)}
              style={{ padding: "14px 16px", borderRadius: 14, border: sel ? `2px solid ${teal600}` : "1px solid #ddd", background: sel ? teal50 : "white", cursor: "pointer", display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 22, height: 22, borderRadius: "50%", border: sel ? `2px solid ${teal600}` : "1.5px solid #888", background: sel ? teal600 : "transparent", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {sel && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "white" }} />}
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 500, color: sel ? teal800 : "#222" }}>{o.label}</div>
                <div style={{ fontSize: 13, color: sel ? teal600 : "#666", marginTop: 2 }}>{o.desc}</div>
              </div>
            </div>
          );
        })}
      </div>
      <button onClick={() => { if (selected) startChat(selected); }} disabled={!selected}
        style={{ padding: "12px 0", fontSize: 15, fontWeight: 500, cursor: selected ? "pointer" : "not-allowed", borderRadius: 40, border: "none", background: selected ? teal600 : "#eee", color: selected ? "white" : "#aaa", marginTop: 4 }}>
        Start coaching →
      </button>
    </div>
  );

  const visible = messages.filter(m => !m.hidden);
  const timeline = [];
  for (let i = 0; i < visible.length; i++) {
    timeline.push({ type: "msg", data: visible[i], key: `msg-${i}` });
    hypoInstances
      .filter(h => h.msgIndex === i)
      .forEach(inst => timeline.push({ type: "hypo", data: inst, key: `hypo-${inst.id}` }));
  }

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "10px 16px", borderBottom: "0.5px solid #eee", display: "flex", alignItems: "center", gap: 10 }}>
        <Avatar size={38} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 500 }}>Your business coach</div>
          <div style={{ fontSize: 12, color: teal600 }}>online</div>
        </div>
      </div>

      {choiceRef.current && choiceRef.current !== "custom" && (
        <div style={{ padding: "8px 16px", borderBottom: "0.5px solid #eee", display: "flex", gap: 8, flexWrap: "wrap" }}>
          {OPTIONS.map(o => {
            const isChosen = choiceRef.current === o.id;
            return (
              <div key={o.id} style={{ padding: "6px 14px", borderRadius: 20, fontSize: 13, border: isChosen ? `1.5px solid ${teal600}` : "1px solid #ddd", background: isChosen ? teal50 : "transparent", color: isChosen ? teal800 : "#999", fontWeight: isChosen ? 500 : 400, lineHeight: 1.4 }}>
                <span style={{ fontWeight: 500 }}>{isChosen ? "✓ " : ""}{o.label}</span>
                <span style={{ opacity: 0.7, marginLeft: 4 }}>— {o.desc}</span>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: 14, minHeight: 400 }}>
        {timeline.map(item => {
          if (item.type === "msg") {
            const m = item.data;
            return (
              <div key={item.key} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", alignItems: "flex-end", gap: 8 }}>
                {m.role === "assistant" && <Avatar size={30} />}
                <div style={{ maxWidth: "78%", padding: "10px 14px", borderRadius: m.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px", background: m.role === "user" ? purple600 : "#f5f5f5", color: m.role === "user" ? "white" : "#222", border: m.role === "user" ? "none" : "0.5px solid #e8e8e8" }}>
                  {renderText(m.display || m.content, m.role === "user")}
                </div>
              </div>
            );
          }
          if (item.type === "hypo") {
            const inst = item.data;
            if (inst.done) return null;
            return (
              <HypoButtons
                key={item.key}
                options={inst.options}
                onPick={(h) => pickHypo(inst.id, h)}
                onOther={inst.isCustom ? () => handleOther(inst.id) : null}
              />
            );
          }
          return null;
        })}

        {showSummaryPrompt && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingLeft: 38 }}>
            <button onClick={() => setScreen("download")}
              style={{ textAlign: "left", padding: "11px 16px", borderRadius: 14, border: `1.5px solid ${teal600}`, background: teal50, color: teal800, fontSize: 14, cursor: "pointer", fontWeight: 500 }}>
              View full breakdown →
            </button>
            <button onClick={() => setShowSummaryPrompt(false)}
              style={{ textAlign: "left", padding: "11px 16px", borderRadius: 14, border: "1px solid #ddd", background: "white", color: "#666", fontSize: 14, cursor: "pointer" }}>
              Keep chatting
            </button>
          </div>
        )}

        {loading && (
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
            <Avatar size={30} />
            <div style={{ padding: "12px 16px", borderRadius: "16px 16px 16px 4px", background: "#f5f5f5", border: "0.5px solid #e8e8e8" }}>
              <span style={{ display: "inline-flex", gap: 5 }}>
                {[0, 1, 2].map(d => <span key={d} style={{ width: 6, height: 6, borderRadius: "50%", background: "#bbb", display: "inline-block", animation: `boun 1.2s ${d * 0.2}s infinite` }} />)}
              </span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div style={{ borderTop: "0.5px solid #eee", padding: "10px 12px", display: "flex", gap: 8, alignItems: "flex-end" }}>
        <textarea value={input} onChange={e => { setInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"; }}
          onKeyDown={handleKey} placeholder="Type your answer..." rows={2}
          style={{ flex: 1, resize: "none", fontSize: 14, padding: "8px 12px", borderRadius: 14, border: "0.5px solid #ddd", background: "white", color: "#222", fontFamily: "inherit", outline: "none", overflowY: "hidden" }} />
        <button onClick={() => send()} disabled={loading || !input.trim()}
          style={{ padding: "10px 18px", fontSize: 14, cursor: loading || !input.trim() ? "not-allowed" : "pointer", borderRadius: 40, border: "none", background: loading || !input.trim() ? "#eee" : teal600, color: loading || !input.trim() ? "#aaa" : "white", fontWeight: 500, alignSelf: "flex-end", whiteSpace: "nowrap" }}>
          Send
        </button>
      </div>
      <style>{`@keyframes boun{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-5px)}}`}</style>
    </div>
  );
}
