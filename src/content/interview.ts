// Behavioral-round and mock-interview content. Descriptions are written for this app;
// check each company's own careers pages before a loop, since wording changes over time.

export type ThemeId = "conflict" | "failure" | "ownership" | "deadline" | "ambiguity" | "impact" | "customer" | "learning" | "disagree" | "mentoring" | "tradeoff" | "initiative";

export const THEMES: { id: ThemeId; label: string; story: string }[] = [
  { id: "conflict", label: "Conflict with a teammate", story: "You and a colleague clashed on how to do something, and you resolved it without escalating." },
  { id: "failure", label: "A failure or mistake", story: "Something went wrong because of you. What you did right after, and what you changed so it can't recur." },
  { id: "ownership", label: "Ownership beyond your role", story: "You fixed or drove something nobody had assigned to you." },
  { id: "deadline", label: "Tight deadline / pressure", story: "Too much work, too little time. How you cut scope and still shipped." },
  { id: "ambiguity", label: "Ambiguous problem", story: "Vague requirements or an unclear goal. How you found out what actually mattered." },
  { id: "impact", label: "Biggest technical impact", story: "Your proudest technical work, with a measurable result. Expect deep follow-up questions." },
  { id: "customer", label: "Customer / user focus", story: "You changed a plan because of what users actually needed." },
  { id: "learning", label: "Learning something fast", story: "You had to get productive in an unfamiliar technology or domain quickly." },
  { id: "disagree", label: "Disagreeing with a manager or decision", story: "You pushed back with data, and then committed to the final decision either way." },
  { id: "mentoring", label: "Helping or mentoring others", story: "You made a teammate or the team better: onboarding, reviews, docs, unblocking." },
  { id: "tradeoff", label: "A hard trade-off", story: "Speed vs quality, build vs buy, simple vs scalable. How you decided, and in hindsight." },
  { id: "initiative", label: "Improving a process", story: "You noticed waste (slow CI, flaky tests, manual toil) and made it better for everyone." },
];

export const STAR = [
  { key: "situation", letter: "S", label: "Situation", share: "~15%", guide: "One or two sentences of context: team, project, what was at stake. Skip the history lesson.", prompt: "Where were you, what was the project, and why did it matter?" },
  { key: "task", letter: "T", label: "Task", share: "~10%", guide: "Your specific responsibility or the goal you owned. Make it clear what YOU had to do.", prompt: "What exactly were you responsible for?" },
  { key: "action", letter: "A", label: "Action", share: "~60%", guide: "The heart of the answer. The concrete steps YOU took, in order, and why. Say \"I\", not \"we\". Include one decision you weighed.", prompt: "What did you do, step by step? What options did you consider?" },
  { key: "result", letter: "R", label: "Result", share: "~15%", guide: "The outcome with a number (latency, revenue, hours saved, bugs, users), plus what you learned or would do differently.", prompt: "What changed, measurably? What did you learn?" },
] as const;

export type StarKey = (typeof STAR)[number]["key"];

export const STAR_TIPS = [
  "Aim for 2 to 3 minutes per story when spoken. Over 4 minutes and the interviewer loses the thread.",
  "Prepare 6 to 8 stories, then map each to several themes. One strong story can answer five different questions.",
  "Use recent stories (last 2 to 3 years). Students can use projects, internships, hackathons, clubs and part-time jobs.",
  "Lead with the headline: \"I cut our API's p95 latency from 900 ms to 120 ms by...\" then tell it in STAR order.",
  "Quantify the result. If you have no number, describe the concrete change (\"the on-call rotation stopped getting paged for it\").",
  "Have a real failure story. \"I work too hard\" answers fail. What matters is what you did next.",
  "Expect follow-ups: \"What would you do differently?\", \"What did your manager think?\", \"What was the hardest part?\". Know the details.",
  "Never blame teammates. Describe the conflict neutrally and focus on how you resolved it.",
];

export const BEHAVIORAL_PITFALLS = [
  { title: "\"We\" instead of \"I\"", text: "Interviewers are hiring you, not your team. Credit others, but make your own actions explicit." },
  { title: "No result, or a vague one", text: "\"It went well\" scores low. Give numbers or a concrete before/after." },
  { title: "Rambling setup", text: "Two minutes of context before any action. Keep Situation + Task under 30 seconds." },
  { title: "Hypothetical answers", text: "\"I would...\" when asked \"Tell me about a time...\". They want a real past example." },
  { title: "A fake weakness or a failure that isn't one", text: "Pick a real mistake with real consequences, then show what you changed." },
  { title: "Memorized and robotic", text: "Know the bullet points of each story, not a script. Practice out loud, differently each time." },
];

export interface LeadershipPrinciple {
  name: string;
  meaning: string;
  listenFor: string;
  question: string;
  themes: ThemeId[];
}

/** Amazon's 16 Leadership Principles (names as published by Amazon; summaries are our own paraphrase). */
export const AMAZON_LPS: LeadershipPrinciple[] = [
  { name: "Customer Obsession", meaning: "Start from the customer and work backwards; earn and keep their trust.", listenFor: "You understood a real user need and changed your plan because of it.", question: "Tell me about a time you went above and beyond for a customer.", themes: ["customer"] },
  { name: "Ownership", meaning: "Think long term, act on behalf of the whole company, and never say \"that's not my job\".", listenFor: "You took responsibility for something outside your remit and saw it through.", question: "Tell me about a time you took on something significant outside your area of responsibility.", themes: ["ownership", "initiative"] },
  { name: "Invent and Simplify", meaning: "Look for new ideas everywhere and find ways to make things simpler.", listenFor: "A creative or simpler solution, and how you got buy-in for it.", question: "Tell me about a time you found a simple solution to a complex problem.", themes: ["initiative", "impact"] },
  { name: "Are Right, A Lot", meaning: "Strong judgment and good instincts, and seeking views that challenge your own.", listenFor: "A decision made with incomplete data, and how you checked your assumptions.", question: "Tell me about a time you made a decision without all the data you wanted.", themes: ["ambiguity", "tradeoff"] },
  { name: "Learn and Be Curious", meaning: "Never stop learning and keep looking to improve yourself.", listenFor: "Something you learned on your own initiative and then applied.", question: "Tell me about a time you had to learn a new skill or technology quickly.", themes: ["learning"] },
  { name: "Hire and Develop the Best", meaning: "Raise the bar with every hire and help others grow.", listenFor: "You coached or mentored someone and they measurably improved.", question: "Tell me about a time you helped a teammate grow.", themes: ["mentoring"] },
  { name: "Insist on the Highest Standards", meaning: "Keep raising the bar so that defects don't get passed along.", listenFor: "You refused to ship something sub-par, or raised a team's quality bar.", question: "Tell me about a time you weren't satisfied with the status quo.", themes: ["initiative", "tradeoff"] },
  { name: "Think Big", meaning: "Create and communicate a bold direction that inspires results.", listenFor: "A larger vision you proposed beyond the immediate task.", question: "Tell me about a time you proposed a bold idea.", themes: ["impact", "initiative"] },
  { name: "Bias for Action", meaning: "Speed matters. Many decisions are reversible and don't need extensive study.", listenFor: "You moved quickly on a reversible decision with calculated risk.", question: "Tell me about a time you had to act quickly without complete information.", themes: ["deadline", "ambiguity"] },
  { name: "Frugality", meaning: "Accomplish more with less. Constraints breed resourcefulness.", listenFor: "You delivered despite limited time, people or money, or you cut cost.", question: "Tell me about a time you accomplished something with limited resources.", themes: ["deadline", "tradeoff"] },
  { name: "Earn Trust", meaning: "Listen, speak candidly, treat others respectfully, and admit your own mistakes.", listenFor: "You owned a mistake openly, or rebuilt a strained working relationship.", question: "Tell me about a time you had to give or receive difficult feedback.", themes: ["conflict", "failure"] },
  { name: "Dive Deep", meaning: "Stay connected to the details and audit them. No task is beneath you.", listenFor: "You dug into data or code to find a root cause others missed.", question: "Tell me about a time you used data to find the root cause of a problem.", themes: ["impact", "failure"] },
  { name: "Have Backbone; Disagree and Commit", meaning: "Challenge decisions you disagree with, respectfully, then commit fully once decided.", listenFor: "You pushed back with evidence and then committed to the outcome.", question: "Tell me about a time you strongly disagreed with your manager.", themes: ["disagree", "conflict"] },
  { name: "Deliver Results", meaning: "Focus on the key inputs, deliver with quality and on time, and don't settle despite setbacks.", listenFor: "You hit a goal despite a significant obstacle.", question: "Tell me about a time you delivered under a tight deadline.", themes: ["deadline", "impact"] },
  { name: "Strive to be Earth's Best Employer", meaning: "Create a safer, more productive, more diverse and more empathetic work environment.", listenFor: "You made your team's working environment better for others.", question: "Tell me about a time you made your team a better place to work.", themes: ["mentoring", "initiative"] },
  { name: "Success and Scale Bring Broad Responsibility", meaning: "Be humble and thoughtful about the secondary effects of your actions.", listenFor: "You considered the wider impact of a decision on users or society.", question: "Tell me about a time you considered the broader consequences of a technical decision.", themes: ["tradeoff", "customer"] },
];

export interface BehavioralQuestion {
  q: string;
  themes: ThemeId[];
  probing: string;
  common?: boolean;
}

export const BEHAVIORAL_QUESTIONS: BehavioralQuestion[] = [
  { q: "Tell me about yourself.", themes: ["impact"], probing: "A 60–90 second pitch: current role, one highlight, why this job. Not your life story.", common: true },
  { q: "Why do you want to work here?", themes: ["customer"], probing: "Specific reasons tied to the product, team or engineering challenges, not salary or prestige.", common: true },
  { q: "Tell me about a time you had a conflict with a coworker.", themes: ["conflict"], probing: "Empathy, direct communication, resolving it without escalating or blaming.", common: true },
  { q: "Tell me about a time you failed.", themes: ["failure"], probing: "Self-awareness and accountability. What you changed afterwards matters most.", common: true },
  { q: "Tell me about the most challenging project you've worked on.", themes: ["impact", "ambiguity"], probing: "Technical depth, your specific role, and how you handled the hard parts.", common: true },
  { q: "Tell me about a time you disagreed with your manager.", themes: ["disagree"], probing: "Backbone with respect: data-driven pushback, then committing to the decision.", common: true },
  { q: "Tell me about a time you had to meet a tight deadline.", themes: ["deadline"], probing: "Prioritization, scope cutting, communicating early about risk.", common: true },
  { q: "Tell me about a time you took ownership of something that wasn't your job.", themes: ["ownership"], probing: "Initiative and follow-through without being asked.", common: true },
  { q: "Tell me about a time you worked with unclear requirements.", themes: ["ambiguity"], probing: "Asking the right questions, making assumptions explicit, iterating.", common: true },
  { q: "What's the biggest mistake you made in production?", themes: ["failure"], probing: "Incident handling, honest root cause, and the prevention you put in place." },
  { q: "Tell me about a time you received critical feedback.", themes: ["learning", "failure"], probing: "Coachability: did you change your behavior?", common: true },
  { q: "Tell me about a time you helped a struggling teammate.", themes: ["mentoring"], probing: "Collaboration and generosity; how you helped without taking over." },
  { q: "Tell me about a time you had to learn a new technology quickly.", themes: ["learning"], probing: "Learning strategy and how fast you became productive." },
  { q: "Tell me about a time you improved a process for your team.", themes: ["initiative"], probing: "Noticing friction and fixing it, with measurable impact." },
  { q: "Tell me about a time you made a decision with incomplete data.", themes: ["ambiguity", "tradeoff"], probing: "Judgment, managing risk, choosing reversible steps." },
  { q: "Describe a technical trade-off you made and whether it was right.", themes: ["tradeoff"], probing: "Engineering judgment and honest hindsight." },
  { q: "Tell me about a time you put the user first, even when it cost you.", themes: ["customer"], probing: "Customer obsession over convenience or metrics." },
  { q: "Tell me about a time you persuaded others to adopt your idea.", themes: ["disagree", "initiative"], probing: "Influence without authority: data, prototypes, listening to objections." },
  { q: "Tell me about a time you had too many priorities at once.", themes: ["deadline", "tradeoff"], probing: "How you ranked work, said no, and communicated it." },
  { q: "Tell me about a time a project you were on was failing. What did you do?", themes: ["failure", "ownership"], probing: "Raising the alarm early, and the recovery plan you drove." },
  { q: "Tell me about a time you went deep to find the root cause of a bug.", themes: ["impact", "failure"], probing: "Systematic debugging, persistence and data." },
  { q: "Tell me about a time you simplified something complex.", themes: ["initiative", "impact"], probing: "Removing complexity, and the effect on the team or system." },
  { q: "Tell me about a time you had to say no to a stakeholder.", themes: ["disagree", "tradeoff"], probing: "Protecting priorities while keeping the relationship." },
  { q: "Tell me about a time you mentored someone.", themes: ["mentoring"], probing: "Teaching approach and the measurable growth of the other person." },
  { q: "Tell me about a time you missed a deadline.", themes: ["failure", "deadline"], probing: "Honesty, early communication, and what you changed." },
  { q: "Tell me about a time you worked with a difficult stakeholder.", themes: ["conflict", "customer"], probing: "Understanding their goals and finding common ground." },
  { q: "What's a project you're proud of and why?", themes: ["impact"], probing: "Passion, ownership and technical depth; expect drill-down questions." },
  { q: "Tell me about a time you raised the quality bar on your team.", themes: ["initiative", "mentoring"], probing: "Standards: tests, reviews, docs, monitoring." },
  { q: "Tell me about a time you had to make a quick decision under pressure.", themes: ["deadline", "ambiguity"], probing: "Composure and a bias for action, with risk awareness." },
  { q: "Where do you see yourself in a few years?", themes: ["learning"], probing: "Growth mindset and a plausible fit with this role." },
  { q: "Tell me about a time you onboarded onto a large unfamiliar codebase.", themes: ["learning", "ambiguity"], probing: "How you navigate, ask for help, and start contributing." },
  { q: "Tell me about a time you had to work with another team to deliver.", themes: ["conflict", "ownership"], probing: "Cross-team collaboration, dependencies and alignment." },
];

export interface ExampleStory {
  title: string;
  themes: ThemeId[];
  question: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  why: string;
}

export const EXAMPLE_STORIES: ExampleStory[] = [
  {
    title: "The slow checkout page",
    themes: ["impact", "ownership", "customer"],
    question: "Tell me about a technical problem you're proud of solving.",
    situation: "At my last internship our checkout page took about 4 seconds to load on mobile, and the product team had noticed a drop in completed orders.",
    task: "I wasn't on the performance team, but I owned the checkout frontend, so I volunteered to find out why and fix what I could within the sprint.",
    action:
      "I profiled the page in Chrome DevTools and found two causes: we loaded a 600 KB analytics bundle before first paint, and we made four API calls one after another. I proposed deferring analytics until after the page was interactive, and I wrote a small backend endpoint that returned the cart, addresses and shipping options in one response. I measured each change separately so we'd know which helped, and I added a performance budget check to CI so the bundle couldn't silently grow back.",
    result: "Mobile load time dropped from about 4.1 s to 1.6 s, and completed checkouts on mobile went up by about 3% over the next month. The CI budget check caught two regressions later that quarter. I learned to measure before optimizing: my first guess, image sizes, turned out to be minor.",
    why: "Clear ownership, an \"I\"-focused Action with a decision explained, two numbers in the Result, and a lesson learned. It maps to Ownership, Dive Deep, Customer Obsession and Deliver Results.",
  },
  {
    title: "The migration that broke reports",
    themes: ["failure", "ownership"],
    question: "Tell me about a time you made a mistake.",
    situation: "I wrote a database migration that renamed a column in our orders table. The tests passed and the deploy went fine.",
    task: "The next morning the finance team's nightly report was empty. The report job was mine to fix because my migration had caused it.",
    action:
      "I told my lead and the finance contact immediately, before I knew the full cause, and gave them an estimate for a fix. The report job read the old column name through raw SQL that our tests didn't cover. I shipped a fix within two hours and re-ran the missed report. Then I wrote a short post-mortem and proposed a rule for renames: add the new column, write to both, migrate readers, and only then drop the old one. I also added the report query to our integration tests.",
    result: "Finance got their report the same morning with no lasting impact. The team adopted the expand-and-contract rule for schema changes, and we haven't had a migration break a downstream job since. I learned to search for every reader of the data I'm changing, not just the code I know about.",
    why: "A real mistake with real consequences, owned openly (Earn Trust), fixed fast, and followed by a systemic prevention. That makes a failure story strong.",
  },
  {
    title: "Disagreeing about a rewrite",
    themes: ["disagree", "tradeoff", "conflict"],
    question: "Tell me about a time you disagreed with your manager.",
    situation: "Our team's notification service was hard to change, and my manager proposed rewriting it from scratch in a new framework over a quarter.",
    task: "I thought a full rewrite was too risky for a service that sent password resets, and I needed to raise that without simply blocking the plan.",
    action:
      "I asked for a day to gather data before we committed. I pulled our incident history and found that 80% of the pain came from one module, the retry and templating logic. I wrote a one-page proposal to replace just that module behind the existing interface, with a two-week estimate and a rollback plan, and I presented it next to the rewrite option with the risks of each. My manager still preferred a larger change, so we agreed on a compromise: start with my module, and decide on the rest afterwards.",
    result: "The module replacement shipped in two and a half weeks and cut notification incidents from about six a month to one. With the main pain gone, the team decided the full rewrite wasn't worth it. Even if they had gone ahead, I'd committed to helping. I learned that bringing an alternative with data works far better than just objecting.",
    why: "Respectful pushback grounded in data, a concrete alternative, and a clear commitment either way. That's Have Backbone; Disagree and Commit.",
  },
];

export interface CompanyNote {
  company: string;
  format: string;
  focus: string;
}

export const COMPANY_NOTES: CompanyNote[] = [
  { company: "Amazon", format: "Every interviewer in the loop asks behavioral questions, each assigned a few Leadership Principles. One \"Bar Raiser\" from outside the team has a strong say in the decision.", focus: "Prepare 1–2 stories per principle. Expect deep follow-ups that test whether the story is really yours." },
  { company: "Google", format: "Usually one round focused on behavior and collaboration (often called \"Googleyness and leadership\"), alongside the technical rounds.", focus: "Collaboration, handling ambiguity, humility, and doing the right thing for users." },
  { company: "Meta", format: "A dedicated behavioral round, weighted more heavily for experienced hires.", focus: "Conflict resolution, driving impact, growing from feedback, and working across teams." },
  { company: "Microsoft", format: "Behavioral questions are woven into most rounds, often at the start of a coding interview.", focus: "Growth mindset, collaboration and customer focus." },
  { company: "Startups and mid-size companies", format: "Often a \"culture\" or hiring-manager conversation rather than a structured round.", focus: "Ownership, shipping fast, and wearing many hats. Your project stories matter a lot." },
];

// ---------- Mock interviews ----------

export type MockKind = "coding" | "practical" | "behavioral";

export interface Phase {
  name: string;
  minutes: number;
  goal: string;
  checklist: string[];
}

export const PHASES: Record<MockKind, Phase[]> = {
  coding: [
    { name: "Clarify", minutes: 5, goal: "Make sure you're solving the right problem.", checklist: ["Restate the problem in your own words", "Ask about input size, value ranges, duplicates, empty input", "Agree on the function signature and return value", "Write one or two small examples, including an edge case"] },
    { name: "Approach", minutes: 10, goal: "Agree on a plan before you write code.", checklist: ["Say the brute force and its complexity first", "Name the pattern you're reaching for (two pointers, BFS, DP...)", "Explain the better approach and its time/space complexity", "Ask: \"Does this sound good before I code it?\""] },
    { name: "Code", minutes: 20, goal: "Clean, working code while narrating.", checklist: ["Keep talking: say what each block does as you write it", "Use clear variable names", "Handle the edge cases you listed", "If stuck, say what you're thinking instead of going silent"] },
    { name: "Test", minutes: 7, goal: "Find your own bugs before the interviewer does.", checklist: ["Trace your code line by line on a small example", "Run the edge cases: empty, one element, duplicates, large values", "Fix bugs calmly and explain the fix", "Restate the final complexity"] },
    { name: "Wrap-up", minutes: 3, goal: "End well.", checklist: ["Mention follow-ups you'd consider (scale, other inputs)", "Ask the interviewer a thoughtful question"] },
  ],
  practical: [
    { name: "Clarify scope", minutes: 8, goal: "Pin down what \"done\" means for the time box.", checklist: ["List the requirements back and confirm priorities", "Ask what can be skipped (persistence, styling, auth...)", "Agree on the API or component interface first"] },
    { name: "Design", minutes: 10, goal: "Sketch the structure before typing.", checklist: ["Data model / state shape", "Endpoints or component tree", "Error cases and status codes / loading and empty states", "How you'll test it"] },
    { name: "Build core", minutes: 25, goal: "Get the main path working end to end.", checklist: ["Happy path first, then edge cases", "Commit to a simple version you can finish", "Narrate decisions and trade-offs"] },
    { name: "Harden", minutes: 12, goal: "Validation, errors and edge cases.", checklist: ["Input validation", "Error handling and messages", "Accessibility or concurrency concerns", "A couple of quick tests"] },
    { name: "Walkthrough", minutes: 5, goal: "Present it like a pull request.", checklist: ["Demo the main flow", "Call out what you'd do with more time", "Discuss how it would scale or change in production"] },
  ],
  behavioral: [
    { name: "Question 1", minutes: 5, goal: "Answer in STAR form in 2–3 minutes, then handle follow-ups.", checklist: ["Headline first", "Situation + Task in under 30 seconds", "Action in \"I\" with a decision explained", "Result with a number and a lesson"] },
    { name: "Question 2", minutes: 5, goal: "A different story from the first.", checklist: ["Pick a story that fits the theme", "Keep it under 3 minutes", "Be ready for \"What would you do differently?\""] },
    { name: "Question 3", minutes: 5, goal: "Stay specific to the end.", checklist: ["No hypotheticals: a real past example", "Credit others, but own your part", "Close with what you learned"] },
  ],
};

/** Things interviewers commonly say mid-round. The simulator surfaces them at random to add pressure. */
export const NUDGES: Record<MockKind, string[]> = {
  coding: [
    "What's the time complexity of that?",
    "Can you do better than that?",
    "What happens if the input is empty?",
    "Walk me through your code with this example.",
    "Why did you choose that data structure?",
    "What if the input doesn't fit in memory?",
    "I see a possible bug on that line. Can you find it?",
    "How much extra space are you using?",
    "What if there are duplicate values?",
    "Can you think of an edge case we haven't covered?",
  ],
  practical: [
    "What status code should that return?",
    "How would you test this?",
    "What happens if two requests arrive at the same time?",
    "How would this work with a real database?",
    "Is this accessible with a keyboard?",
    "What would you cut if you had 10 fewer minutes?",
    "How would you handle a slow or failing dependency?",
    "Where would you add logging or metrics?",
  ],
  behavioral: [
    "What was your specific role in that?",
    "What would you do differently next time?",
    "How did you measure the result?",
    "What did your manager think?",
    "What was the hardest part?",
    "Why did you choose that approach over the alternatives?",
    "What did the other person say?",
  ],
};

export interface RubricDim {
  key: string;
  label: string;
  anchors: [string, string, string, string];
}

/** Four-point scale like big-tech scorecards: 1 strong no, 2 lean no, 3 lean yes, 4 strong yes. */
export const RUBRIC: Record<MockKind, RubricDim[]> = {
  coding: [
    { key: "communication", label: "Communication", anchors: ["Silent or hard to follow", "Explained only when asked", "Narrated most decisions clearly", "Clear throughout; drove the conversation"] },
    { key: "problem", label: "Problem solving", anchors: ["No workable approach", "Brute force only, needed big hints", "Optimal approach with a small hint", "Optimal approach independently, with trade-offs"] },
    { key: "coding", label: "Coding", anchors: ["Code doesn't run or is unfinished", "Works with several bugs; messy", "Correct and readable, minor issues", "Clean, idiomatic, correct first time"] },
    { key: "testing", label: "Testing & verification", anchors: ["Didn't test", "Tested only when prompted", "Traced an example, found bugs", "Systematic edge cases, found own bugs"] },
  ],
  practical: [
    { key: "communication", label: "Communication", anchors: ["Silent or hard to follow", "Explained only when asked", "Explained design and trade-offs", "Clear throughout; presented like a PR"] },
    { key: "design", label: "Design", anchors: ["No structure", "Works but tangled", "Sensible structure and state", "Clean separation, easy to extend"] },
    { key: "completeness", label: "Completeness", anchors: ["Core flow not working", "Core flow works, little else", "Core flow + most requirements", "All requirements, edge cases handled"] },
    { key: "quality", label: "Quality", anchors: ["No validation or error handling", "Some validation", "Validation, errors, a test or two", "Robust, tested, accessible / concurrency-safe"] },
  ],
  behavioral: [
    { key: "structure", label: "Structure (STAR)", anchors: ["Rambling, no clear arc", "Some structure, long setup", "Clear STAR, mostly concise", "Crisp headline and STAR every time"] },
    { key: "ownership", label: "Ownership (\"I\")", anchors: ["All \"we\", role unclear", "Role somewhat clear", "Clear personal actions", "Clear actions and decisions, credits others"] },
    { key: "impact", label: "Impact", anchors: ["No result", "Vague result", "Concrete result", "Quantified result and a lesson learned"] },
    { key: "depth", label: "Depth under follow-ups", anchors: ["Couldn't answer follow-ups", "Thin details", "Solid details", "Rich details; story clearly real"] },
  ],
};

export const SIGNALS = [
  { min: 0, label: "Strong no hire", cls: "text-rose" },
  { min: 1.75, label: "Lean no hire", cls: "text-orange" },
  { min: 2.5, label: "Lean hire", cls: "text-amber" },
  { min: 3.25, label: "Strong hire", cls: "text-emerald" },
];

export const PRESSURE_TIPS = [
  { title: "Think out loud, always", text: "Silence reads as being stuck. Narrate even half-formed thoughts: \"I'm considering a hash map here because...\". Interviewers can only give credit, and hints, for what they hear." },
  { title: "Start with the brute force", text: "Saying a working slow solution in the first few minutes takes the pressure off and gives you something to optimize." },
  { title: "Use a fixed opening routine", text: "Restate → ask about constraints → write an example → state the brute force. A routine you've rehearsed runs on autopilot when nerves hit." },
  { title: "When you blank, say so and back up", text: "\"Let me step back and look at a small example.\" Working a tiny case by hand unsticks most problems." },
  { title: "Taking a hint is fine", text: "Interviewers expect to give hints. Using one well scores much better than ignoring it or staying stuck in silence." },
  { title: "Practice with the clock running", text: "Solving a problem in 2 hours at home is a different skill from solving it in 30 minutes with someone watching. Time every practice." },
  { title: "Practice with a human", text: "Someone watching changes everything. Do at least 5 to 10 live mocks before a real loop, and play the interviewer too: you learn what a strong answer looks like." },
  { title: "Write code without autocomplete", text: "Many interviews use a plain editor or shared doc. Practice in one so missing autocomplete doesn't throw you." },
];

export const PEER_PLATFORMS = [
  { name: "Exponent Practice (formerly Pramp)", url: "https://www.tryexponent.com/practice", text: "Free peer-to-peer mocks: you interview a partner and they interview you. Pramp moved onto Exponent in 2024; the free tier is limited per month." },
  { name: "interviewing.io", url: "https://interviewing.io", text: "Anonymous mock interviews with engineers from big tech companies, mostly paid, plus a library of recorded real interviews to watch." },
  { name: "A friend or study group", url: null, text: "Free and flexible. Use this page's partner mode: one person plays interviewer with the hints and rubric, then you swap." },
];
