import {
    Action,
    ActionExample,
    IAgentRuntime,
    Memory,
    State,
    Content,
    HandlerCallback,
    generateText,
    ModelClass,
    composeContext,
    parseJSONObjectFromText
} from "@elizaos/core";
import { PermissionsBitField } from "discord.js";

const botDetailsTemplate = `# Messages we are analyzing
{{recentMessages}}

# Instructions: Parse the user's request for bot management. The user wants to add a bot to the server.
Determine if they provided a bot invite link or if they just named a common bot.

Your response must be formatted as a JSON block with this structure:
\`\`\`json
{
  "inviteUrl": "full Discord bot invite URL if provided",
  "botName": "name of the bot if mentioned",
  "reason": "reason for adding the bot"
}
\`\`\`

Common bot invite links should be constructed as:
For MEE6: https://mee6.xyz/add
For Dyno: https://dyno.gg/invite
For Mudae: https://discord.com/oauth2/authorize?client_id=432610292342587392&permissions=537159744&scope=bot
For ProBot: https://probot.io/invite
For Rythm: https://rythm.fm/invite

`;

const getBotDetails = async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State
) => {
    state = await runtime.composeState(message);

    const context = composeContext({
        state,
        template: botDetailsTemplate,
    });

    for (let i = 0; i < 3; i++) {
        try {
            const response = await generateText({
                runtime,
                context,
                modelClass: ModelClass.SMALL,
            });

            const parsedResponse = parseJSONObjectFromText(response) as {
                inviteUrl: string;
                botName: string;
                reason: string;
            };

            if (parsedResponse?.inviteUrl || parsedResponse?.botName) {
                return parsedResponse;
            }
        } catch (error) {
            console.error('Error parsing bot details:', error);
        }
    }
    return null;
};

// Known bot invite links and their common names
const KNOWN_BOTS = {
    'mee6': 'https://mee6.xyz/add',
    'dyno': 'https://dyno.gg/invite',
    'mudae': 'https://discord.com/oauth2/authorize?client_id=432610292342587392&permissions=537159744&scope=bot',
    'probot': 'https://probot.io/invite',
    'rythm': 'https://rythm.fm/invite',
    // Add more known bots here
};

const manageBotAction: Action = {
    name: "MANAGE_BOTS",
    similes: [
        "INVITE_BOT",
        "ADD_BOT",
        "BRING_BOT",
        "GET_BOT",
        "INSTALL_BOT",
    ],
    description: "Helps with inviting other bots to the Discord server.",
    validate: async (runtime: IAgentRuntime, message: Memory, state: State) => {
        if (message.content.source !== "discord") {
            return false;
        }

        // Keywords that indicate bot management intent
        const keywords = [
            "bot",
            "invite",
            "add",
            "bring",
            "install",
            "get",
            ...Object.keys(KNOWN_BOTS),  // Include known bot names
        ];

        return keywords.some(keyword =>
            message.content.text.toLowerCase().includes(keyword.toLowerCase())
        );
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        options: any,
        callback: HandlerCallback
    ) => {
        try {
            const discordMessage = state.discordMessage;
            if (!discordMessage?.guild) {
                await callback({
                    text: "I can only manage bots in a Discord server, not in DMs.",
                    action: "MANAGE_BOTS_RESPONSE",
                    source: message.content.source,
                });
                return;
            }

            // Check if the user has admin permissions
            const member = discordMessage.member;
            if (!member?.permissions.has(PermissionsBitField.Flags.Administrator)) {
                await callback({
                    text: "Sorry, only server administrators can add bots to the server.",
                    action: "MANAGE_BOTS_RESPONSE",
                    source: message.content.source,
                });
                return;
            }

            const botDetails = await getBotDetails(runtime, message, state);
            if (!botDetails) {
                await callback({
                    text: "I couldn't understand which bot you want to add. Please provide a bot name or invite link.",
                    action: "MANAGE_BOTS_RESPONSE",
                    source: message.content.source,
                });
                return;
            }

            let inviteUrl = botDetails.inviteUrl;

            // If no direct URL but we have a bot name, check known bots
            if (!inviteUrl && botDetails.botName) {
                const botNameLower = botDetails.botName.toLowerCase();
                inviteUrl = Object.entries(KNOWN_BOTS).find(
                    ([name]) => botNameLower.includes(name.toLowerCase())
                )?.[1];
            }

            let response: Content = {
                text: "",
                action: "MANAGE_BOTS_RESPONSE",
                source: message.content.source,
            };

            if (inviteUrl) {
                response.text = `Here's the invite link for ${botDetails.botName || "the bot"}: ${inviteUrl}\n\n` +
                              `You can add the bot to the server by clicking that link. Make sure to review the permissions carefully before adding it.`;
            } else {
                response.text = `I'm not familiar with that bot. Please provide the bot's invite link directly, or use one of these common bots:\n` +
                              Object.keys(KNOWN_BOTS).map(name => `• ${name}`).join('\n');
            }

            await callback(response);
            return response;

        } catch (error) {
            console.error('Error in manage bots action:', error);
            await callback({
                text: `Failed to process bot invitation: ${error.message}`,
                action: "MANAGE_BOTS_RESPONSE",
                source: message.content.source,
            });
        }
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Can you add MEE6 to the server?",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "I'll help you add MEE6 to the server.",
                    action: "MANAGE_BOTS",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Invite Dyno bot please",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "Here's how to add Dyno to the server.",
                    action: "MANAGE_BOTS",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Can you help me get Mudae in here?",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "I'll provide the invite link for Mudae.",
                    action: "MANAGE_BOTS",
                },
            },
        ],
    ] as ActionExample[][],
};

export default manageBotAction;