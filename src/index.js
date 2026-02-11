require('dotenv').config();

const { App } = require('@slack/bolt');

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  port: process.env.PORT || 3000
});

// Utility: start-of-today timestamp in seconds
function getTodayTs() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  return start.getTime() / 1000;
}

// Format a message line for the modal
function formatMessageLine(msg, usersById) {
  const userName =
    (msg.user && usersById[msg.user] && usersById[msg.user].real_name) ||
    (msg.user && `<@${msg.user}>`) ||
    'Unknown';

  const dt = new Date(Number(msg.ts.split('.')[0]) * 1000);
  const timeStr = dt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

  // Slack already stores mentions in link form; keep raw text
  let text = msg.text || '';

  // Simple trim of overly long messages
  const maxLen = 300;
  if (text.length > maxLen) {
    text = text.slice(0, maxLen - 3) + '...';
  }

  return `*${timeStr}* – *${userName}*\n${text}`;
}

// Slash command handler – scan all channels the user is in
app.command(process.env.SLASH_COMMAND || '/today-alerts', async ({ command, ack, client, body }) => {
  await ack();

  const userId = command.user_id;

  try {
    const oldest = getTodayTs();
    const userMentionToken = userId ? `<@${userId}>` : null;

    // 1. Get all channels the user is a member of
    const channels = [];
    let cursor;
    do {
      const resp = await client.users.conversations({
        user: userId,
        types: 'public_channel,private_channel',
        cursor,
        limit: 100
      });
      channels.push(...(resp.channels || []));
      cursor = resp.response_metadata && resp.response_metadata.next_cursor;
    } while (cursor);

    // 2. For each channel, fetch today's messages and filter
    const allUserIds = new Set();
    const channelResults = [];

    for (const ch of channels) {
      try {
        const history = await client.conversations.history({
          channel: ch.id,
          oldest: oldest.toString()
        });

        const filtered = (history.messages || []).filter((msg) => {
          if (!msg.text) return false;
          const text = msg.text;
          const hasHere = text.includes('<!here>');
          const hasChannel = text.includes('<!channel>');
          const hasUser =
            (userMentionToken && text.includes(userMentionToken)) ||
            text.toLowerCase().includes('@varahasimhan.s');
          return hasHere || hasChannel || hasUser;
        });

        if (filtered.length > 0) {
          filtered.forEach((m) => {
            if (m.user) allUserIds.add(m.user);
          });

          channelResults.push({
            channel: ch,
            messages: filtered
          });
        }
      } catch (e) {
        // ignore individual channel failures
      }
    }

    // 3. Fetch basic user info for display names (deduped)
    const usersById = {};
    for (const uid of allUserIds) {
      try {
        const u = await client.users.info({ user: uid });
        if (u.user) usersById[uid] = u.user;
      } catch (e) {
        // ignore
      }
    }

    // 4. Build blocks grouped by channel
    let blocks = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Today’s important messages across your channels*'
        }
      },
      {
        type: 'divider'
      }
    ];

    if (channelResults.length === 0) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'No messages today with `@here`, `@channel`, or `@varahasimhan.s` in any of your channels.'
        }
      });
    } else {
      // Sort channels alphabetically for consistency
      channelResults.sort((a, b) => (a.channel.name || '').localeCompare(b.channel.name || ''));

      const maxMessagesTotal = 80;
      let count = 0;

      for (const { channel, messages } of channelResults) {
        if (count >= maxMessagesTotal) break;

        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*#${channel.name}*`
          }
        });
        blocks.push({ type: 'divider' });

        for (const msg of messages) {
          if (count >= maxMessagesTotal) break;
          blocks.push({
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: formatMessageLine(msg, usersById)
            }
          });
          blocks.push({ type: 'divider' });
          count += 1;
        }
      }

      if (count >= maxMessagesTotal) {
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '_Showing first 80 messages for today. Consider narrowing with a specific channel if needed._'
          }
        });
      }
    }

    // 5. Open as a modal popover
    await client.views.open({
      trigger_id: body.trigger_id,
      view: {
        type: 'modal',
        title: {
          type: 'plain_text',
          text: 'Today’s Mentions',
          emoji: true
        },
        close: {
          type: 'plain_text',
          text: 'Close',
          emoji: true
        },
        blocks
      }
    });
  } catch (error) {
    console.error('Error handling slash command', error);

    // Best-effort error to user (fallback to the channel where command was issued)
    try {
      await client.chat.postEphemeral({
        channel: command.channel_id,
        user: userId,
        text: 'Sorry, I could not fetch today’s messages across your channels.'
      });
    } catch (e) {
      // ignore
    }
  }
});

(async () => {
  await app.start();
  console.log('⚡️ Slack summary app is running');
})();

