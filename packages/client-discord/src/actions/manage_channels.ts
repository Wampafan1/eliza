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
import { ChannelType } from "discord.js";

const channelDetailsTemplate = `# Messages we are analyzing
{{recentMessages}}

# Instructions: Parse the user's request for Discord channel management.
Your response must contain ONLY a JSON block in the following format, with no additional text:

\`\`\`json
{
  "action": "create",
  "channelName": "channel-name",
  "channelType": "text",
  "reason": "reason for action"
}
\`\`\`

Rules:
1. action must be exactly "create", "modify", or "delete"
2. channelName must be lowercase with hyphens instead of spaces
3. channelType must be "text", "voice", "forum", or "announcement"
4. If no channel type is specified, use "text"
5. Provide a brief reason for the action

Examples:
"make an announcements channel" ->
\`\`\`json
{
  "action": "create",
  "channelName": "announcements",
  "channelType": "text",
  "reason": "For server announcements"
}
\`\`\`

"create voice channel for gaming" ->
\`\`\`json
{
  "action": "create",
  "channelName": "gaming",
  "channelType": "voice",
  "reason": "For gaming voice chat"
}
\`\`\`

Based on the messages above, generate the appropriate JSON response following these rules exactly.
Respond ONLY with the JSON block, no other text.
`;

const getChannelDetails = async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State
) => {
    state = await runtime.composeState(message);

    const context = composeContext({
        state,
        template: channelDetailsTemplate,
    });

    for (let i = 0; i < 3; i++) {
        try {
            console.log('Attempting to generate response, attempt:', i + 1);
            const response = await generateText({
                runtime,
                context,
                modelClass: ModelClass.SMALL,
            });

            console.log('Raw LLM Response:', response);

            // Extract JSON block from between triple backticks if present
            const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/);
            if (!jsonMatch) {
                console.log('No JSON block found in response');
                continue;
            }

            const jsonStr = jsonMatch[1].trim();
            console.log('Extracted JSON string:', jsonStr);

            try {
                const parsedResponse = JSON.parse(jsonStr);
                console.log('Successfully parsed JSON:', parsedResponse);

                if (parsedResponse?.action && parsedResponse?.channelName) {
                    // Normalize the response
                    return {
                        action: parsedResponse.action.toLowerCase(),
                        channelName: parsedResponse.channelName.toLowerCase().replace(/\s+/g, '-'),
                        channelType: parsedResponse.channelType?.toLowerCase() || 'text',
                        reason: parsedResponse.reason || 'User requested channel action'
                    };
                }
            } catch (parseError) {
                console.error('JSON Parse Error:', parseError);
                console.error('Attempted to parse string:', jsonStr);
                continue;
            }
        } catch (error) {
            console.error('Error in channel details generation:', error);
        }
    }
    console.log('Failed to get valid channel details after all attempts');
    return null;
};

const manageChannelsAction: Action = {
    name: "MANAGE_CHANNELS",
    similes: [
        "CREATE_CHANNEL",
        "DELETE_CHANNEL",
        "MODIFY_CHANNEL",
        "MAKE_CHANNEL",
        "REMOVE_CHANNEL",
        "ADD_CHANNEL",
    ],
    description: "Creates, modifies, or deletes Discord channels based on user requests.",
    validate: async (runtime: IAgentRuntime, message: Memory, state: State) => {
        if (message.content.source !== "discord") {
            return false;
        }

        const keywords = [
            "channel",
            "create",
            "make",
            "add",
            "delete",
            "remove",
            "modify",
            "change",
            "rename",
            "setup",
            "text channel",
            "voice channel",
            "category",
            "forum",
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
                    text: "I can only manage channels in a Discord server, not in DMs.",
                    action: "MANAGE_CHANNELS_RESPONSE",
                    source: message.content.source,
                });
                return;
            }

            const channelDetails = await getChannelDetails(runtime, message, state);
            if (!channelDetails) {
                await callback({
                    text: "I couldn't understand the channel management request. Please provide more details.",
                    action: "MANAGE_CHANNELS_RESPONSE",
                    source: message.content.source,
                });
                return;
            }

            let response: Content = {
                text: "",
                action: "MANAGE_CHANNELS_RESPONSE",
                source: message.content.source,
            };

            const getChannelType = (type: string): ChannelType => {
                switch (type.toLowerCase()) {
                    case 'voice':
                        return ChannelType.GuildVoice;
                    case 'forum':
                        return ChannelType.GuildForum;
                    case 'announcement':
                        return ChannelType.GuildAnnouncement;
                    case 'text':
                    default:
                        return ChannelType.GuildText;
                }
            };

            switch (channelDetails.action.toLowerCase()) {
                case 'create':
                    const newChannel = await discordMessage.guild.channels.create({
                        name: channelDetails.channelName,
                        type: getChannelType(channelDetails.channelType),
                        reason: channelDetails.reason
                    });
                    response.text = `Created new ${channelDetails.channelType} channel: ${newChannel.name}`;
                    break;

                case 'delete':
                    const channelToDelete = discordMessage.guild.channels.cache.find(
                        channel => channel.name === channelDetails.channelName
                    );
                    if (channelToDelete) {
                        await channelToDelete.delete(channelDetails.reason);
                        response.text = `Deleted channel: ${channelDetails.channelName}`;
                    } else {
                        response.text = `Couldn't find channel: ${channelDetails.channelName}`;
                    }
                    break;

                case 'modify':
                    const channelToModify = discordMessage.guild.channels.cache.find(
                        channel => channel.name === channelDetails.channelName
                    );
                    if (channelToModify) {
                        await channelToModify.setName(channelDetails.channelName);
                        response.text = `Modified channel: ${channelDetails.channelName}`;
                    } else {
                        response.text = `Couldn't find channel: ${channelDetails.channelName}`;
                    }
                    break;

                default:
                    response.text = "I don't understand that channel management action.";
                    break;
            }

            await callback(response);
            return response;

        } catch (error) {
            console.error('Error in manage channels action:', error);
            await callback({
                text: `Failed to manage channel: ${error.message}`,
                action: "MANAGE_CHANNELS_RESPONSE",
                source: message.content.source,
            });
        }
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Can you create a new text channel called announcements?",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "I'll create that channel for you right away.",
                    action: "MANAGE_CHANNELS",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Delete the general-chat channel please",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "I'll delete that channel for you.",
                    action: "MANAGE_CHANNELS",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "I need a voice channel for team meetings",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "I'll create a voice channel for team meetings.",
                    action: "MANAGE_CHANNELS",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Make an announcement channel",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "Creating an announcement channel now.",
                    action: "MANAGE_CHANNELS",
                },
            },
        ],
    ] as ActionExample[][],
};

export default manageChannelsAction;