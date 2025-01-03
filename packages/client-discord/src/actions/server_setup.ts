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
import pkg from "discord.js";
const {
    ChannelType,
    PermissionsBitField,
    GuildVerificationLevel,
    Colors
} = pkg;

const setupDetailsTemplate = `# Messages we are analyzing
{{recentMessages}}

# Instructions: Parse the user's request for server security setup.
Determine what security features they want to implement.

Your response must be formatted as a JSON block with this structure:
\`\`\`json
{
  "setupType": "full|roles|verification|automod",
  "verificationLevel": "none|low|medium|high|highest",
  "explicitContentFilter": "disabled|members|all",
  "roles": [
    {
      "name": "role name",
      "color": "hex color",
      "permissions": ["permission1", "permission2"],
      "position": number
    }
  ],
  "verification": {
    "requireCaptcha": boolean,
    "minimumAccountAge": number,
    "requirePhoneVerification": boolean
  },
  "automod": {
    "antiSpam": boolean,
    "antiRaid": boolean,
    "antiPhishing": boolean,
    "maxMentions": number,
    "maxEmojis": number
  }
}
\`\`\`
`;

// Default role configuration for a secure server
const DEFAULT_ROLES = [
    {
        name: "Admin",
        color: Colors.Red,
        permissions: [
            PermissionsBitField.Flags.Administrator
        ],
        position: 5
    },
    {
        name: "Moderator",
        color: Colors.Green,
        permissions: [
            PermissionsBitField.Flags.ManageMessages,
            PermissionsBitField.Flags.KickMembers,
            PermissionsBitField.Flags.BanMembers,
            PermissionsBitField.Flags.ManageRoles,
            PermissionsBitField.Flags.ViewAuditLog
        ],
        position: 4
    },
    {
        name: "Verified",
        color: Colors.Blue,
        permissions: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ReadMessageHistory,
            PermissionsBitField.Flags.Connect,
            PermissionsBitField.Flags.Speak
        ],
        position: 3
    },
    {
        name: "Unverified",
        color: Colors.Grey,
        permissions: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.ReadMessageHistory
        ],
        position: 2
    }
];

const getSetupDetails = async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State
) => {
    state = await runtime.composeState(message);

    const context = composeContext({
        state,
        template: setupDetailsTemplate,
    });

    for (let i = 0; i < 3; i++) {
        try {
            const response = await generateText({
                runtime,
                context,
                modelClass: ModelClass.SMALL,
            });

            const parsedResponse = parseJSONObjectFromText(response);
            if (parsedResponse?.setupType) {
                return parsedResponse;
            }
        } catch (error) {
            console.error('Error parsing setup details:', error);
        }
    }
    return null;
};

const setupServerAction: Action = {
    name: "SETUP_SERVER",
    similes: [
        "SECURE_SERVER",
        "PROTECT_SERVER",
        "CONFIGURE_SERVER",
        "SERVER_SECURITY",
        "SETUP_VERIFICATION",
        "SETUP_ROLES"
    ],
    description: "Sets up comprehensive server security including roles, permissions, verification, and automod.",
    validate: async (runtime: IAgentRuntime, message: Memory, state: State) => {
        if (message.content.source !== "discord") {
            return false;
        }

        const keywords = [
            "setup",
            "secure",
            "protect",
            "configure",
            "security",
            "verification",
            "roles",
            "permissions",
            "automod",
            "server safety",
            "server protection"
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
            const guild = discordMessage?.guild;

            if (!guild) {
                await callback({
                    text: "I can only set up security in a Discord server, not in DMs.",
                    action: "SETUP_SERVER_RESPONSE",
                    source: message.content.source,
                });
                return;
            }

            // Check if user has admin permissions
            const member = discordMessage.member;
            if (!member?.permissions.has(PermissionsBitField.Flags.Administrator)) {
                await callback({
                    text: "Sorry, only server administrators can modify server security settings.",
                    action: "SETUP_SERVER_RESPONSE",
                    source: message.content.source,
                });
                return;
            }

            const setupDetails = await getSetupDetails(runtime, message, state);
            if (!setupDetails) {
                await callback({
                    text: "I couldn't understand the setup requirements. Please specify what security features you want to implement.",
                    action: "SETUP_SERVER_RESPONSE",
                    source: message.content.source,
                });
                return;
            }

            let response: Content = {
                text: "Starting server security setup...\n\n",
                action: "SETUP_SERVER_RESPONSE",
                source: message.content.source,
            };

            // Set up basic server security
            if (setupDetails.setupType === "full" || setupDetails.verificationLevel) {
                // Verification levels: 0 = NONE, 1 = LOW, 2 = MEDIUM, 3 = HIGH, 4 = HIGHEST
                const verificationLevel = setupDetails.verificationLevel?.toUpperCase() === "HIGHEST" ? 4 :
                                        setupDetails.verificationLevel?.toUpperCase() === "HIGH" ? 3 :
                                        setupDetails.verificationLevel?.toUpperCase() === "MEDIUM" ? 2 :
                                        setupDetails.verificationLevel?.toUpperCase() === "LOW" ? 1 : 3; // Default to HIGH

                // Explicit content filter levels: 0 = DISABLED, 1 = MEMBERS_WITHOUT_ROLES, 2 = ALL_MEMBERS
                const contentFilter = setupDetails.explicitContentFilter?.toUpperCase() === "ALL" ? 2 :
                                    setupDetails.explicitContentFilter?.toUpperCase() === "MEMBERS" ? 1 : 2; // Default to ALL

                await guild.setVerificationLevel(verificationLevel);
                await guild.setExplicitContentFilter(contentFilter);
                response.text += "✅ Updated server verification and content filter settings\n";
            }

            // Set up roles
            if (setupDetails.setupType === "full" || setupDetails.roles) {
                const rolesToCreate = setupDetails.roles || DEFAULT_ROLES;
                for (const roleConfig of rolesToCreate) {
                    const existingRole = guild.roles.cache.find(r => r.name === roleConfig.name);
                    if (!existingRole) {
                        await guild.roles.create({
                            name: roleConfig.name,
                            color: roleConfig.color as ColorResolvable,
                            permissions: roleConfig.permissions,
                            position: roleConfig.position,
                            reason: "Server security setup"
                        });
                    }
                }
                response.text += "✅ Created security roles with appropriate permissions\n";
            }

            // Set up verification system
            if (setupDetails.setupType === "full" || setupDetails.verification) {
                // Create verification channel
                const verificationChannel = await guild.channels.create({
                    name: "verification",
                    type: ChannelType.GuildText,
                    permissionOverwrites: [
                        {
                            id: guild.roles.everyone.id,
                            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory],
                            deny: [PermissionsBitField.Flags.SendMessages]
                        }
                    ]
                });

                // Set up verification message
                await verificationChannel.send({
                    content: "Welcome to the server! Please react to this message to begin verification.",
                });

                response.text += "✅ Set up verification channel and system\n";
            }

            // Set up automod
            if (setupDetails.setupType === "full" || setupDetails.automod) {
                // Create automod rules
                await guild.autoModerationRules.create({
                    name: "Prevent Spam",
                    eventType: 1, // MESSAGE_SEND
                    triggerType: 3, // SPAM
                    enabled: true,
                    reason: "Server security setup"
                });

                await guild.autoModerationRules.create({
                    name: "Block Suspicious Content",
                    eventType: 1, // MESSAGE_SEND
                    triggerType: 4, // KEYWORD_PRESET
                    enabled: true,
                    triggerMetadata: {
                        presets: [1, 2, 3] // PROFANITY, SEXUAL_CONTENT, SLURS
                    },
                    reason: "Server security setup"
                });

                response.text += "✅ Configured AutoMod rules for spam and content filtering\n";
            }

            // Create logs channel
            const logsChannel = await guild.channels.create({
                name: "mod-logs",
                type: ChannelType.GuildText,
                permissionOverwrites: [
                    {
                        id: guild.roles.everyone.id,
                        deny: [PermissionsBitField.Flags.ViewChannel]
                    }
                ]
            });

            response.text += "✅ Created mod-logs channel for tracking security events\n\n";
            response.text += "Server security setup is complete! Make sure to:\n" +
                           "1. Review and adjust role permissions as needed\n" +
                           "2. Set up role hierarchy\n" +
                           "3. Configure additional channel-specific permissions\n" +
                           "4. Test the verification system";

            await callback(response);
            return response;

        } catch (error) {
            console.error('Error in server setup action:', error);
            await callback({
                text: `Failed to set up server security: ${error.message}`,
                action: "SETUP_SERVER_RESPONSE",
                source: message.content.source,
            });
        }
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Can you set up security for this server?",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "I'll help set up comprehensive server security.",
                    action: "SETUP_SERVER",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "We need verification and role setup",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "I'll set up the verification system and roles.",
                    action: "SETUP_SERVER",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Make this server secure with automod and verification",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "Setting up server protection with AutoMod and verification.",
                    action: "SETUP_SERVER",
                },
            },
        ],
    ] as ActionExample[][],
};

export default setupServerAction;