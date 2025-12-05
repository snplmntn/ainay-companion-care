# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/2369f660-6183-4392-a85f-63771d7b889c

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/2369f660-6183-4392-a85f-63771d7b889c) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS
- Supabase (Auth + Database)

## Environment Setup

Create an `.env.local` file in the project root:

```bash
# Supabase (Required for auth and data persistence)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# OpenAI (Required for AI features + Morning Briefing TTS)
VITE_OPENAI_API_KEY=sk-...
VITE_OPENAI_MODEL=gpt-4o

# WeatherAPI.com (Required for Morning Briefing weather - FREE instant activation!)
# Get your key at: https://www.weatherapi.com/signup.aspx
VITE_WEATHERAPI_KEY=your-weatherapi-key
```

## Supabase Setup

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Copy your project URL and anon key from Settings > API

### 2. Set Up Database Tables

Run the SQL schema in `supabase/schema.sql`:

1. Go to SQL Editor in your Supabase dashboard
2. Paste the contents of `supabase/schema.sql`
3. Click "Run" to create all tables and policies

### 3. Configure Authentication

1. Go to Authentication > Providers
2. Ensure Email provider is enabled
3. (Optional) Disable email confirmation for development:
   - Go to Authentication > Settings
   - Turn off "Enable email confirmations"

### Features powered by Supabase

| Feature           | Service        | Description                     |
| ----------------- | -------------- | ------------------------------- |
| User signup/login | Auth           | Email + password authentication |
| User profiles     | Database (RLS) | Name, role, preferences         |
| Medications       | Database (RLS) | Stored per-user with RLS        |
| Data sync         | Realtime       | Auto-sync across devices        |

> **Demo Mode**: Users can also try the app without an account. Data won't be persisted.

## OpenAI Setup

The OpenAI API key is configured in `.env.local` (see Environment Setup above).

### Features powered by OpenAI

| Feature                 | API Used         | Model Required        |
| ----------------------- | ---------------- | --------------------- |
| Chat responses          | Chat Completions | gpt-4o or gpt-4o-mini |
| Medicine image scanning | Vision API       | gpt-4o (has vision)   |
| Voice messages          | Whisper API      | whisper-1 (automatic) |

### How it works

- **Text chat**: Type a question and AInay responds using GPT-4o
- **Image scanning**: Take a photo or upload images of medicines (supports multiple at once). GPT-4o Vision identifies each medicine, explains its purpose, dosage, and warnings
- **Voice input**: Hold the mic button to record, release to transcribe via Whisper and auto-send

> **Security note**: The API key is used client-side. Keep it safe, use spending limits, and rotate it if exposed. For production, consider proxying requests through a backend.

## Morning Briefing ("Health Radio") Feature

A personalized audio briefing that plays when users open the app - like a friendly health radio station for seniors.

### How it works

1. **Weather API**: Fetches current weather from OpenWeatherMap for Manila
2. **Schedule**: Gets today's medication list from the user's profile
3. **Script**: GPT-4o writes a warm, 3-4 sentence script combining weather + meds
4. **Audio**: OpenAI TTS (Text-to-Speech) generates the MP3 instantly with a friendly voice

### Example output

> "Good morning, Lola! It's going to be rainy in Manila today, so don't forget your jacket. You have 3 medicines today. Your first one is Losartan at 8:00 AM after breakfast. Stay safe!"

### Features powered by Morning Briefing

| Feature           | API Used          | Description                                     |
| ----------------- | ----------------- | ----------------------------------------------- |
| Weather info      | OpenWeatherMap    | Current weather in Manila with advice           |
| Script generation | GPT-4o            | Personalized, warm greeting combining all data  |
| Audio synthesis   | OpenAI TTS (nova) | Friendly female voice at 0.9x speed for clarity |
| Caching           | LocalStorage      | Briefings cached for 1 hour                     |

> **Why it wins**: Audio demos are powerful in a loud hackathon hall. It shows accessibility for the blind/elderly.

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/2369f660-6183-4392-a85f-63771d7b889c) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
