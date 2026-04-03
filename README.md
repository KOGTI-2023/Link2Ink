# Link 2 Ink Studio

Link 2 Ink is a visual intelligence platform that transforms GitHub repositories into interactive architectural blueprints and converts web articles into concise, professional infographics.

## Architecture

- **Frontend Framework**: React 19 + Vite
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Data Visualization**: D3.js
- **AI Integration**: Google GenAI SDK (`@google/genai`)

## Prerequisites

- Node.js (v22+ recommended)
- npm or yarn
- A Gemini API Key

## Setup & Local Development

### Windows One-Click Setup (Recommended)

If you are on Windows, you can simply double-click the `start.bat` file. It will:
- Check for Node.js
- Create a `.env` file if it doesn't exist
- Install dependencies if needed
- Start the development server

### Environment Configuration

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Open `.env` and add your Gemini API Key:
   ```env
   GEMINI_API_KEY=your_api_key_here
   ```

### Standard Node.js Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the development server:
   ```bash
   npm run dev
   ```
3. Open `http://localhost:3000` in your browser.

### Docker Setup

You can also run the application using Docker Compose:

1. Ensure Docker and Docker Compose are installed.
2. Run the following command:
   ```bash
   docker-compose up --build
   ```
3. Open `http://localhost:3000` in your browser.

## Verification Steps

- The application should load the home screen with a "Link2Ink Studio" header.
- If you haven't set an API key or if the environment doesn't provide one, an API Key Modal will prompt you to enter one.
- Navigate to "GitFlow" or "SiteSketch" to test the repository analyzer and article-to-infographic features.

## Troubleshooting

- **Port 3000 in use**: Ensure no other application is using port 3000. You can change the port in `vite.config.ts` if necessary, though 3000 is the default.
- **API Key issues**: Ensure your `GEMINI_API_KEY` is correctly set in `.env`. The app uses `process.env.GEMINI_API_KEY` via Vite's `define` config.
