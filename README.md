# Slack Today Alerts

A Slack slash command that shows today's important messages across all channels you're a member of. Only displays messages containing `@here`, `@channel`, or mentions of you (`@varahasimhan.s`).

## Features

- Scans all channels you're a member of (public and private)
- Filters messages from today only
- Shows messages with `@here`, `@channel`, or your mentions
- Displays results in a Slack modal popover
- Groups messages by channel

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   - Copy `.env.example` to `.env`
   - Fill in your Slack app credentials:
     - `SLACK_BOT_TOKEN` - Bot User OAuth Token from your Slack app
     - `SLACK_SIGNING_SECRET` - Signing Secret from your Slack app
     - `SLASH_COMMAND` - Your slash command (default: `/today-alerts`)
     - `PORT` - Port to run the app on (default: 3000)

3. **Set up your Slack app:**
   - Create a new app at https://api.slack.com/apps
   - Add bot token scopes:
     - `commands`
     - `channels:history`
     - `groups:history`
     - `channels:read`
     - `groups:read`
     - `chat:write`
     - `users:read`
   - Create a slash command (e.g., `/today-alerts`)
   - Set Request URL to your ngrok URL: `https://<your-ngrok-url>/slack/events`
   - Install the app to your workspace

4. **Run locally with ngrok:**
   ```bash
   # Terminal 1: Start the app
   npm start
   
   # Terminal 2: Start ngrok tunnel
   ngrok http 3000
   ```
   - Update the Slack Request URL with your ngrok HTTPS URL

## Usage

In any Slack channel, type your slash command (e.g., `/today-alerts`). A modal will open showing all relevant messages from today across your channels.

## Development

- `npm start` - Run the app
- `npm run dev` - Run with nodemon for auto-restart
