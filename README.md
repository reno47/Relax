<div align="center">

# 🧘 Relax

### _Get it together — then relax._

Relax is a personal productivity hub that brings your **Azure DevOps work items**,
**GitHub repos**, **infrastructure links**, **important portals**, a **leave/status
calendar**, and **rich notes** together into a single, beautiful dashboard —
private to you, synced across your devices.

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)
![Vercel](https://img.shields.io/badge/Hosted%20on-Vercel-000000?logo=vercel&logoColor=white)
![Auth by Clerk](https://img.shields.io/badge/Auth-Clerk-6C47FF?logo=clerk&logoColor=white)

</div>

---

## ✨ What you get

| | Feature | Description |
|---|---|---|
| 📋 | **TFS / Azure DevOps** | See the work items **assigned to you** automatically, scoped to your team's area — grouped by iteration (current on top) with live **status** badges. Filter by **Feature / Story / Bug** and by iteration, or pin any item by ID. |
| 🐙 | **GitHub** | Organise your repositories into drag‑and‑drop columns and collapsible groups. |
| ☁️ | **Infra** | Quick access to your cloud consoles, CI/CD and environment links. |
| 🔗 | **Important Portals** | One click to the sites you open every day (mail, HR, learning…). |
| 🗓️ | **Calendar** | Mark days by category (leave, WFH, sick…), see per‑category summaries, and back up/restore your calendar. |
| 📝 | **Notes** | A rich‑text notebook with sections and pages — bold/italic/underline, colours, sizes, and pasted images. |
| 🌗 | **Light & Dark themes** | A modern light theme and a calm dark theme — your choice follows you across devices. |
| 🔄 | **Everything syncs** | Your data is saved to your private account and available on any browser or device you sign in from. |

---

##  Getting started

Relax is a **hosted web app** — there is nothing to install.

1. Access is **invite‑only**. Once you've been invited, you'll receive a sign‑in
   link.
2. Sign in with your **email** (secure, passwordless magic link — no password to
   remember).
3. That's it. Start adding your links, notes and work items.

Want to try TFS? In the **TFS** tab, open *Azure DevOps connection* and add your
**organization**, a **Personal Access Token** (Work Items – Read), and your
**area path**. Your assigned items appear instantly. Your token is stored
**encrypted** and only used for your own lookups.

---

## 🧰 Built with

- **React 18 + TypeScript** and **Vite** — a fast, modern single‑page app.
- **Clerk** — secure, passwordless authentication.
- **Vercel** — global hosting and serverless functions.
- **Upstash Redis** — your data, isolated per user.
- **Azure DevOps REST API** — live work‑item data.

---

## 💡 How it works (in plain terms)

- You sign in with your email. The app knows it's you.
- Everything you add is saved to **your** private space in the cloud and cached
  locally so it loads instantly.
- Sign in on another device and your dashboard is exactly as you left it.
- Your Azure DevOps token is **encrypted** before it's stored, and is never shown
  back to the browser.

---

## 🐞 Feedback, bugs & feature ideas

We'd love your input! Please use **GitHub Issues**:

- 🐞 **Report a bug** → [open a bug report](https://github.com/reno47/Relax/issues/new)
- 💡 **Suggest a feature** → [request an enhancement](https://github.com/reno47/Relax/issues/new)
- 💬 Browse or comment on existing ideas → [all issues](https://github.com/reno47/Relax/issues)

When reporting a bug, a quick description of **what you did**, **what you
expected**, and **what happened** (plus your browser) helps us fix it faster.

---

## 🔒 Your privacy

- Your data is **isolated per user** — no one else can see your dashboard.
- Access is **invite‑only**.
- Sensitive credentials (like your Azure DevOps token) are **encrypted at rest**.
- The app only requests the minimum access it needs to show your own work items.

---

## 👩‍💻 For contributors

Interested in improving the product? Start here:

- 🛠️ [Local setup & contributing guide](docs/local-setup.md)
- 🧭 [Architecture](docs/architecture.md)
- 📂 [Codebase guide](docs/codebase.md)
- 🚀 [Deployment & environments](docs/deployment.md)

---

<div align="center">
Made with ❤️ for people who like their day organised.
</div>
