# How Manus Uses E2B to Provide Agents With Virtual Computers — E2B Blog

**URL:** https://e2b.dev/blog/how-manus-uses-e2b-to-provide-agents-with-virtual-computers

---

***
WE RAISED $21M SERIES A
LEARN WHAT’S NEXT →
***
PRODUCT
PRICING
RESOURCES

ENTERPRISE
BOOK A CALL
CAREERS
SIGN UP
SIGN IN
↩ BLOG
/
CASE STUDIES
HOW MANUS USES E2B TO PROVIDE AGENTS WITH VIRTUAL COMPUTERS
TEREZA TIZKOVA
GROWTH
MAY 6, 2025
5
MIN
SHARE

‍

When Manus launched its general-purpose AI agent, it quickly became one of the most talked-about new platforms in the AI space.  Behind the viral launch is a technically sophisticated multi-agent system that actually manages to execute real-world workflows end to end. 

Manus is not a single LLM agent—it’s a more complex coordination system. Prompts go first to a planner agent that decomposes them into a sequence of subtasks. Then, executor agents carry them out using a variety of tools, from web browsing and file search to running commands in a terminal.

For this, the Manus agent needs a full cloud computer, and that’s why it relies on E2B - a secure cloud platform designed for AI agents to run untrusted code securely and at scale.

‍

It’s Not Enough to Just Run Code

For AI agents to actually get things done and act like autonomous humans, they must be able to perform tasks from data analysis to using a terminal.

“Manus doesn’t just run some pieces of code. It uses 27 different tools, and it needs E2B to have a full virtual computer to work as a real human.”

- Tao Zhang, Co-founder at Manus

A lot of the tasks go down to code, which is like the core of the agent. But a mere code execution isn’t enough. Manus agent needs its virtual computer, the same as if it were a human researcher working on the task end-to-end, sometimes taking even dozens of minutes.

Under the hood, E2B uses Firecracker microVMs—ephemeral, lightweight virtual machines originally developed by AWS. These VMs serve as whole virtual computers for Manus. Inside the sandbox, agents can run Python, JavaScript, Bash, and more.

E2B sandboxes can run for hours in persistent sessions while the agent decides in each iteration which action to perform in the sandbox. For paid users, they can save information in the E2B sandbox for up to 14 days.

The tools span from using the Chromium browser to visit URLs, save images, and scroll, through executing terminal commands to using the filesystem to create, edit, or delete files.

This means that agents in Manus can act more like real researchers or developers, keeping context between steps, updating plans, and producing complex artifacts—all within the same isolated sandbox session. It’s important to be able to pause and resume the sandbox sessions, for example, when the agent needs to check something with the user, requires credentials to access certain websites, or when passing the “verify you are human” tests.

Why Manus Chose E2B, and not Alternatives

Manus team started building the agent, they tried to find a solution that would offer a fast and scalable environment for the agent.

During the first testing phase, they tried Docker. The problem was, it was really slow (10 - 20 seconds to spawn), but most importantly, Docker, as a container solution, doesn’t have full functionality of an operating systems. And Manus team needed real operating system so the agent can perform actions like installing apps or Python packages. That’s why they started searching for a solution built specifically for LLM-powered applications - and they discovered E2B.

“E2B was the best solution, and it looked like every company was using it.”

- Tao Zhang, Co-founder at Manus

When deciding, Manus also went for E2B because of these factors:

Speed: A new sandbox can spin up in ~150ms, fast enough to keep up with the users’ standards
Good DX: Manus team was able to implement and deploy E2B in half a day
Scalability: Manus is gaining a lot of users quickly, and they need each user to have the agent work in a separate instance from the others
Self-hosting option: Manus is running E2B on their machines. E2B self-hosting is easy to manage

Could Manus have built this infrastructure themselves? Technically, yes—but it would have taken months of work by a dedicated infra team. Re-creating and maintaining an infrastructure stack from scratch would have required 3–5 full-time infra engineers.

For most teams building agent platforms, that’s a distraction from product and research work. With E2B, Manus was able to ship faster and focus entirely on improving their multi-agent orchestration instead of reinventing cloud runtime infrastructure for their agents.

Future Plans

Developers often ask about Manus selecting E2B over container alternatives. Looking ahead, Manus aims to extend agent capabilities across various operating systems, including Windows and Android. Since not all information and services exist solely on the web, environments like virtual Android significantly expand what their agents can access and accomplish.

“We chose E2B because we were thinking about the future.”

- Tao Zhang, Co-founder at Manus

Currently, Manus is already used for a variety of applications beyond just creating reports and charts. Manus' team is travelling around the world to talk to users and learn about different use cases.

For example, the Chief Editor of Financial Times Chinese showcased a 3D-printed model representing the past decade of US national debt, generated entirely through Manus.

Another example Manus team seen recently in Dubai, where a social media consultant leveraged Manus to develop comprehensive content strategies for clients. The agent, after being provided with the client’s website and social media profiles, generated complete one-year strategies including audience targeting, titles, content, hook sentences, and channel-specific recommendations. The resulting 50+ page document costs approximately $6-7 to produce, yet commands thousands in consulting fees.

Manus has a lot ahead, and this is just the beginning. By pushing boundaries and learning from real-world use cases, the team is committed to creating an AI platform that delivers exceptional value across industries while remaining accessible to all users.

Learn more
Manus landing page
Manus LinkedIn
Manus X
Give Your Agents
Secure AI Sandbox
Get started today.
SIGN UP
SEE ALSO
↩ VIEW ALL
We discussed the Agent Protocol with the community
1
min
·
Jul 25, 2023
INTERVIEWS
Up to 5x Faster Sandboxes
1
min
·
Feb 26, 2024
PRODUCT
Code Interpreter Sandbox
5
min
·
Nov 7, 2023
PRODUCT
Follow @e2b on X to see live updates.
/
We're hiring! Check open positions on the Careers page.
/
Hundreds of millions of sandboxes launched.
/
We're always Excited 2 Build.
/
Site
Product
Pricing
Cookbook
Docs
Blog
Company
Careers
Contact
Privacy Policy
Terms of Service
Social
Github
X
Discord
LinkedIn
Status
Check system status
BUILD AND RUN AI AGENTS WITH CONFIDENCE. YOUR DATA IS PROTECTED WITH ENTERPRISE-GRADE SECURITY.
©2026 ✶ FoundryLabs, Inc.