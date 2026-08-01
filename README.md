# 📋 College Attendance Tracker

A smart, subject-wise attendance tracking web app for college students. Upload a photo of your timetable and let Gemini AI extract your schedule automatically — then track daily attendance, monitor your percentage against a target goal, and see exactly how many classes you can afford to skip (or need to attend) to stay safe.

---

## ✨ Features

- **🤖 AI-Powered Timetable Import** — Upload a photo/screenshot of your timetable and Gemini AI extracts subjects, teachers, and time slots automatically, filtered to your specific year, division, and batch.
- **🪄 AI Timetable Generator** — Don't have a timetable image? Generate a realistic one based on your field, semester, and year.
- **✍️ Manual Setup** — Full manual entry and editing of subjects and weekly schedule as an alternative/complement to AI import.
- **📅 Daily Attendance Marking** — Mark each class (or an entire day) as **Attended**, **Skipped**, or **Cancelled**.
- **📊 Live Attendance Dashboard** — Subject-wise and overall attendance percentage, updated in real time.
- **🎯 Goal Tracking** — Set a target attendance percentage (e.g. 75%) and instantly see:
  - Whether you're currently safe or at risk
  - How many more classes you need to attend to hit your goal
  - Projected attendance over the semester
- **🗓️ Semester-Aware Calculations** — Accounts for lectures vs. practicals separately and projects totals across the semester.
- **📝 Daily Notes** — Attach notes to any date on your calendar.
- **🔐 Simple Login** — Lightweight profile-based login (name, email, college) with no external auth provider required.
- **🌙 Modern Dark UI** — Built with Tailwind CSS and Radix-based UI primitives for a clean, responsive experience.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite 6 |
| Styling | Tailwind CSS 4, `tailwind-merge`, `clsx` |
| Animation | Motion (Framer Motion) |
| Icons | Lucide React |
| Backend | Express (via `tsx`), Node.js |
| AI | Google Gemini API (`@google/genai`) |
| OCR (client-side) | Tesseract.js |
| Utilities | `date-fns`, `uuid` |

---

## 📂 Project Structure

```
Attendance-Tracker/
├── server.ts                     # Express server + Gemini API endpoints
├── src/
│   ├── main.tsx                  # App entry point
│   ├── App.tsx                   # Root component / routing logic
│   ├── index.css                 # Global styles
│   ├── types.ts                  # Shared TypeScript types
│   ├── lib/
│   │   └── utils.ts              # Helper utilities
│   ├── context/
│   │   └── AppContext.tsx        # Global app state (user, subjects, attendance log, etc.)
│   ├── components/
│   │   ├── TimePicker12.tsx      # 12-hour time picker component
│   │   └── ui/                   # Reusable UI primitives (button, card, input, label)
│   └── views/
│       ├── Login.tsx             # User login/profile screen
│       ├── Setup.tsx             # Timetable setup (AI upload / generate / manual)
│       └── Dashboard.tsx         # Main attendance dashboard
├── index.html
├── vite.config.ts
├── tsconfig.json
├── package.json
└── .env.example
```

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+ recommended)
- A [Google Gemini API key](https://aistudio.google.com/app/apikey) (required for AI timetable parsing/generation)

### 1. Clone the repository

```bash
git clone https://github.com/<your-username>/Attendance-Tracker.git
cd Attendance-Tracker
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Copy the example env file and add your Gemini API key:

```bash
cp .env.example .env
```

```env
GEMINI_API_KEY="your_gemini_api_key_here"
APP_URL="http://localhost:3000"
```

### 4. Run in development mode

```bash
npm run dev
```

The app will be available at **http://localhost:3000**.

### 5. Build for production

```bash
npm run build
npm start
```

---

## 📖 Usage

1. **Login** — Enter your name, email, and college to get started.
2. **Setup**
   - Fill in your academic profile (year, division, batch, field, semester).
   - Either:
     - 📷 Upload a photo of your timetable for AI extraction, or
     - 🪄 Auto-generate a sample timetable, or
     - ✍️ Add subjects and time slots manually.
   - Review and edit the extracted subjects/schedule before finishing.
3. **Dashboard**
   - Mark attendance per class or for the whole day.
   - Track your live percentage against your goal.
   - Add notes to specific dates.
   - Adjust your attendance goal anytime.

---

## 🔑 Environment Variables

| Variable | Description |
|---|---|
| `GEMINI_API_KEY` | Google Gemini API key used for timetable OCR/parsing and generation |
| `APP_URL` | Base URL of the deployed app (used for self-referential links) |

---

## 🧭 Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Build the client and bundle the server for production |
| `npm start` | Run the production build |
| `npm run preview` | Preview the production build locally |
| `npm run clean` | Remove build artifacts |
| `npm run lint` | Type-check the project with `tsc` |

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the **Apache-2.0 License**.

---

## 🙏 Acknowledgements

- [Google Gemini](https://ai.google.dev/) for AI-powered timetable extraction and generation
- [Tesseract.js](https://tesseract.projectnaptha.com/) for OCR support
- [Lucide](https://lucide.dev/) for icons
