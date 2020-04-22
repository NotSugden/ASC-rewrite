import { join } from 'path';
import { Constants, EmbedFieldData, RoleData, MessageEmbed, Snowflake } from 'discord.js';
import * as moment from 'moment';
import Client from './Client';
import { Invite, PartialMessage } from './Types';
import Util from './Util';
import Case from '../structures/Case';
import Levels from '../structures/Levels';
import Warn from '../structures/Warn';
import Guild from '../structures/discord.js/Guild';
import GuildMember from '../structures/discord.js/GuildMember';
import Message from '../structures/discord.js/Message';
import TextChannel from '../structures/discord.js/TextChannel';
import User from '../structures/discord.js/User';
/* eslint-disable sort-keys */

export enum ModerationActionTypes {
	BAN = Constants.Colors.RED,
	KICK = Constants.Colors.ORANGE,
	MUTE = Constants.Colors.GREY,
	WARN = Constants.Colors.YELLOW
}

const hyperlink = (name: string, url: string) => `[${name}](${url})`;

const messageURL = (guildID: Snowflake, channelID: Snowflake, messageID: Snowflake) =>
	`https://discordapp.com/channels/${guildID}/${channelID}/${messageID}`;

export const Defaults = {
	CLIENT_CONFIG: {
		commands_dir: join(__dirname, '..', 'commands'),
		database: 'database.sqlite',
		files_dir: join(__dirname, '..', 'saved_files')
	},
	// this is a getter for now, incase djs modifies the object
	get MUTE_ROLE_DATA() {
		return {
			color: 'DARKER_GREY',
			hoist: false,
			mentionable: false,
			name: 'Muted',
			permissions: 0
		} as RoleData;
	}
};

export const Errors = {
	INVALID_CLIENT_OPTION: (option: string, className: string) =>
		`Client config option '${option}' couldn't be resolved to a valid ${className}.`,

	CASE_RESOLVE_USER: (index: number) => `Couldn't resolve a User from 'users[${index}]'.`,

	RESOLVE_PROVIDED: (parameter: string) => `Couldn't resolve the User from the provided '${parameter}'.`,

	LEVELS_RESOLVE_ID: (fetch = true) => `Couldn't resolve the User ID to ${fetch ? 'fetch' : 'set'} levels of.`,
	POINTS_RESOLVE_ID: (fetch = true) => `Couldn't resolve the User ID to ${fetch ? 'fetch' : 'set'} points of.`,
	WARNS_RESOLVE_ID: 'Couldn\'t resolve the User ID to fetch warns from.',
	MUTE_RESOLVE_ID: (fetch = true) =>
		`Couldn't resolve the User ID to ${fetch ? 'fetch the mute of' : 'delete the mute'}.`,

	NEGATIVE_NUMBER: (variable: string) => `Provided '${variable}' is negative, and should be positive.`,
	RESOLVE_COMMAND: 'The command passed couldn\'t be resolved',

	COMMAND_LOAD_FAILED: (name: string) => `Failed to load command ${name}`,
	INVALID_TYPE: (parameter: string, type: string) => `Provided '${parameter}' should be a '${type}'`
};

export const CommandErrors = {
	ALL_MUTED: 'All of the mentioned members are muted.',
	ALREADY_REMOVED_USERS: (multiple: boolean, kick = true) =>
		`${multiple ? 'All of the members' : 'The member'} you mentioned ${multiple ? 'have' : 'has'} already ${
			kick ?
				'left or been kicked' :
				'been banned'
		}.`,
	CANNOT_ACTION_USER: (action: keyof typeof ModerationActionTypes, multiple = false) =>
		`You cannot perform a ${action.toLowerCase()} on ${multiple ? 'one of the users you mentioned' : 'this user'}`,
	INVALID_TIME: (time = '2 minutes') => `The time you provided is less than ${time}, which is the minimum.`,
	INSUFFICIENT_PERMISSIONS: 'You have insufficient permissions to perform this action.',
	MENTION_USERS: (users = true) => `Please mention at least 1 ${users ? 'user' : 'member'}.`,
	PROVIDE_REASON: 'Please supply a reason for this action.',
	INVALID_FLAG_TYPE: (flag: string, type: string) => `Flag ${flag} must be ${type}`,
	INVALID_FLAG: (provided: string, valid: string[]) =>
		`Provided flag '${provided}' is not valid, valid flags for this command are: ${valid.join(', ')}`,
	INVALID_CASE_ID: (provided: string) => `'${provided}' isn't a valid case number.`,
	PROVIDE_ATTACHMENT: (valid: string[]) =>
		`Please upload an attachment with one of the following extensions: ${
			valid.map(ext => `\`${ext}\``).join(', ')
		}.`,
	RESOLVE_ID: (id: string) =>
		`An ID or user mention was provided, but the user couldn't be resolved, are you sure its valid? (${id})`,
	TOO_MANY_INVITES: (max = 1) => `A maximum of ${max} invites is permitted here.`,
	NO_INVITE: 'You must provide an invite link.',
	CLIENT_BANNED_INVITE: 'The ASC bot seems to be banned from that guild, ask that server\'s owner why.',
	UNKNOWN_INVITE: (code: string) => `The invite you provided, \`${code}\`, is invalid.`,
	GROUP_INVITE: 'The invite you provided is for a group, not a guild.',
	PARTNER_MEMBER_COUNT: (minimum: boolean) => `The invite you sent ${
		minimum ?
			'does not have enough' :
			'has too many'
	} members for this channel.`
};

export const Responses = {
	TOP: (levels: Levels[], guild: Guild) => {
		return new MessageEmbed()
			.setAuthor('ASC Leaderboards', guild.iconURL({ dynamic: true })!)
			.setDescription(levels.map(
				(data, index) => `**#${index+1}** - ${data.user!.tag} Level ${data.level}`
			))
			.setColor('WHITE');
	},
	LEVEL: (user: User, level: number, xp: number) => {
		const LEFT_BORDER = '<:Lines2:597212619299880962>';
		const RIGHT_BORDER = '<:Lines3:594509306364297228>';
		const RIGHT_ARROW = '<:ASC_RightArrow:608077963635851296>';
		const MIDDLE_BORDER = '<:Lines:597212592167059456>';

		return [
			`**${user.username}**#${user.discriminator}`,
			`${LEFT_BORDER}${MIDDLE_BORDER.repeat(6)}${RIGHT_BORDER}`,
			//`${RIGHT_ARROW} Rank **${rank}**`,
			`${RIGHT_ARROW} Level **${level}**`,
			`${LEFT_BORDER}${MIDDLE_BORDER.repeat(6)}${RIGHT_BORDER}`,
			`XP: **${xp}**/**${Util.levelCalc(level).toFixed(0)}**`
		];
	},
	LEVEL_UP: (user: User, newLevel: number) => ({
		content: `Congrats ${user}, you're now level ${newLevel}.`,
		allowedMentions: {
			users: [user.id]
		}
	}),
	PARTNER_REWARD: (user: User, channel: TextChannel, points: number) => ({
		content: `${user} Was rewarded **${points}** points for a ${channel}.`,
		allowedMentions: {
			users: [user.id]
		}
	}),
	AUTO_REPORT_EMBED: (message: Message) => {
		return new MessageEmbed()
			.setAuthor('Alert')
			.setColor('RED')
			.setDescription(
				`${message.author.tag} (${message.author}) has __${
					message.edits.length > 1 ? 'edited' : 'sent'
				}__ a ${hyperlink('message', message.url)} with a possible restricted term`
			).addFields({
				name: 'Message Content',
				value: message.content
			});
	},
	HISTORY: (cases: Case[]) => {
		return cases.flatMap(caseData => [
			`${caseData.id}: ${caseData.action.charAt(0) + caseData.action.slice(1).toLowerCase()} ${
				caseData.moderator ? caseData.moderator.tag : caseData.moderatorID
			} (${moment.utc(caseData.timestamp).format('DD/MM/YYYY HH:mm A')}): ${caseData.reason}`,
			...Object.entries(caseData.extras).map(([name, value]) => `${name}: ${value}`)
		]);
	},
	WARNINGS: (warns: Warn[]) => {
		return warns.map(warn => `(${warn.caseID}) ${
			warn.moderator ? warn.moderator.tag : warn.moderatorID
		} (${moment.utc(warn.timestamp).format('DD/MM/YYYY HH:mm A')}): ${warn.reason}`);
	},
	MODERATION_LOG_FIELDS: (moderator: User, users: User[]): EmbedFieldData[] => [{
		name: 'Moderator',
		value: moderator.tag
	}, {
		name: `User${users.length > 1 ? 's' : ''} punished`,
		value: users.map(({ tag }) => tag)
	}],
	MODERATION_LOG_DESCRIPTION: (action: keyof typeof ModerationActionTypes, reason: string, extras: object) => {
		const description = [
			`ASC Logs: ${action.charAt(0) + action.slice(1).toLowerCase()}`
		];
		if (Object.keys(extras).length) {
			description.push(...Object.entries(extras)
				.map(([key, value]) => `${key}: ${value}`));
		}
		return [...description, `Reason: ${reason}`];
	},

	AUDIT_LOG_MEMBER_REMOVE: (moderator: User, caseID: number, kick = true) =>
		`${kick ? 'Kicked' : 'Banned'} by ${moderator.tag}: Case ${caseID}`,

	/**
   * Big spaghetti code ;(
	 * if someone wants to prettify this be my guest
	 */
	MEMBER_REMOVE_SUCCESSFUL: ({ filteredUsers, members, users }: {
		filteredUsers?: User[];
		members?: GuildMember[];
		users: User[];
	}, kick = true) => {

		const content = [
			`${kick ? 'Kicked' : 'Banned'} ${
				(members || users).length === 1 ?
					(members ? members[0].user : users[0]).tag :
					`${(members || users).length} members`
			}.`
		];

		const array = members || filteredUsers!;

		if (array.length !== users.length) {
			const amount = users.length - array.length;
			content.push(`Couldn't ${
				kick ? 'kick' : 'ban'
			} ${amount} other user${amount > 1 ? 's' : ''}, as they had already ${
				kick ? 'left/been kicked' : 'been banned'
			}.`);
		}
		return content;
	},

	WARN_SUCCESS: (users: User[], reason: string) =>
		`${users.length > 1 ? `${users.length} Users were` : `${users[0].tag} was`} warned for ${reason}.`,
	MUTE_SUCCESS: (members: GuildMember[], reason: string) =>
		`${members.length > 1 ? `${members.length} Members were` : `${members[0].user.tag} was`} muted for ${reason}.`
};

export const URLs = {
	HASTEBIN: (endpointOrID?: string) => `https://hasteb.in${endpointOrID ? `/${endpointOrID}` : ''}`
};

export const FLAGS_REGEX = /--([a-z]+)=("[^"]*"|[0-9a-z]*)/gi;

export const EventResponses = {
	INVITE_CREATE: (invite: Invite) => {
		return new MessageEmbed()
			.setAuthor(`Invite created in #${(invite.channel as TextChannel).name} by ${
				invite.inviter ? invite.inviter.tag : 'Unknown User#0000'
			}`)
			.setColor(Constants.Colors.GREEN)
			.setDescription([
				`Invite Code: ${hyperlink(invite.code, invite.url)}`,
				`Expires at: ${invite.expiresTimestamp ? moment.utc(invite.expiresAt!).format(
					'DD/MM/YYYY HH:mm A'
				) : 'Never'}`,
				`Inviter: ${invite.inviter ? `${invite.inviter} (${invite.inviter.id})` : 'Unknown User#0000'}`,
				`Max Uses: ${invite.maxUses || 'Infinite'}`,
				`Temporary?: ${invite.temporary ? 'Yes' : 'No'}`
			])
			.setFooter(`User ID: ${invite.inviter ? invite.inviter.id : '00000000000000000'}`)
			.setTimestamp(invite.createdAt!);
	},
	INVITE_DELETE: (invite: Invite) => {
		return new MessageEmbed()
			.setAuthor(`Invite deleted in #${(invite.channel as TextChannel).name}, created by ${
				invite.inviter ? invite.inviter.tag : 'Unknown User#0000'
			}`)
			.setColor(Constants.Colors.RED)
			.setDescription([
				`Inivte Code: ${invite.code}`,
				// Could check for `invite.uses === invite.maxUses` here however it's never updated so there's no point
				`Expired?: ${invite.expiresTimestamp && invite.expiresTimestamp < Date.now() ? 'Yes' : 'No'}`,
				`Inviter: ${invite.inviter ? `${invite.inviter} (${invite.inviter.id})` : 'Unknown User#0000'}`,
				`Max Uses: ${invite.maxUses || 'Infinite'}`,
				`Temporary?: ${invite.temporary ? 'Yes' : 'No'}`
			])
			.setFooter(`User ID: ${invite.inviter ? invite.inviter.id : '00000000000000000'}`)
			.setTimestamp(invite.createdAt!);
	},

	GUILD_MEMBER_ADD: (member: GuildMember & { client: Client }, webhook = true) => ({
		content: `<:ASC_RightArrow:608077963635851296> <@&539532117781118987> to **${
			member.guild.name
		}** ${member.user}, you can click ${
			webhook ? `[here](<${
				messageURL('539355100397699092', '635215364950851659', '635228291556704320')
			}>)` : `<#${member.client.config.rulesChannelID}>`
		} to read the rules!`,
		allowedMentions: {
			users: [member.id],
			roles: ['539532117781118987']
		}
	}),
	GUILD_MEMBER_UPDATE: (oldMember: GuildMember, newMember: GuildMember) => {
		const { user } = newMember;
		const data = [];
		if (oldMember.displayColor !== newMember.displayColor) {
			data.push(`Display Color Changed: ${oldMember.displayHexColor} to ${newMember.displayHexColor}`);
		}

		if (oldMember.nickname !== newMember.nickname) {
			if (!oldMember.nickname || !newMember.nickname) {
				data.push(
					`Nickname ${oldMember.nickname ? 'Removed' : 'Set'}: ${newMember.nickname || oldMember.nickname}`
				);
			} else {
				data.push(`Nickname Changed: ${oldMember.nickname} to ${newMember.nickname}`);
			}
		}

		if (oldMember.premiumSinceTimestamp !== newMember.premiumSinceTimestamp) {
			data.push(`User is ${oldMember.premiumSinceTimestamp ? 'no longer' : 'now'} boosting`);
		}

		if (!oldMember.roles.cache.equals(newMember.roles.cache)) {
			const addedRoles = newMember.roles.cache.filter(role => !oldMember.roles.cache.has(role.id));
			const removedRoles = oldMember.roles.cache.filter(role => !newMember.roles.cache.has(role.id));
			if (addedRoles.size) {
			// I'm not using role mentions here as the log channel is in a different guild
				data.push(`Roles Added: ${addedRoles.map(role => role.name).join(', ')}`);
			}
			/** 
		 	 * Not using an else if as roles can be both removed and added
		 	 * see https://discordapp.com/developers/docs/resources/guild#modify-guild-member
		 	 */
			if (removedRoles.size) {
			// I'm not using role mentions here as the log channel is in a different guild
				data.push(`Roles Removed: ${removedRoles.map(role => role.name).join(', ')}`);
			}
		}

		if (!data.length) return null;

		return new MessageEmbed()
			.setAuthor(user.tag)
			.setColor(Constants.Colors.GREEN)
			.setDescription(data)
			.setFooter(`User ID: ${user.id}`)
			.setThumbnail(user.displayAvatarURL({ dynamic: true }));
	},

	MESSAGE_DELETE: (message: Message | PartialMessage, options: { files: string[]; previous?: Message }) => {
		const embed = new MessageEmbed()
			.setAuthor(`Message Deleted in #${
				(message.channel as TextChannel).name
			} by ${message.author ? message.author.tag : 'Unkown User#0000'}`)
			.setDescription([
				options.previous ? hyperlink('Previous Message', options.previous.url) : 'No previous message',
				`Author ID: ${message.author ? message.author.id : '00000000000000000'}`
			])
			.setColor(Constants.Colors.RED)
			.addField('Content', message.partial ?
				'Message content was not cached' : message.content || 'No content'
			).setFooter(`${message.id} | Created at`)
			.setTimestamp(message.createdAt);
		if (options.files.length) {
			embed.addField(
				`File${options.files.length > 1 ? 's' : ''}`,
				options.files.map(file => `${message.client.config.attachmentsURL}/${file}`)
			);
		}
		return embed;
	},

	MESSAGE_UPDATE: (oldMessage: Message | PartialMessage, newMessage: Message) => {
		return new MessageEmbed()
			.setAuthor(`Message Edited in #${(newMessage.channel as TextChannel).name} by ${newMessage.author.tag}`)
			.setDescription([
				hyperlink('Jump', newMessage.url),
				`Author ID: ${newMessage.author.id}`
			])
			.setColor(Constants.Colors.YELLOW)
			.setFooter(`${newMessage.id} | Created at`)
			.setTimestamp()
			.addFields({
				name: 'Old Content',
				value: oldMessage.partial ? 'Old content wasn\'t cached' : (oldMessage.content || 'No content')
			}, {
				name: 'New Content',
				value: newMessage.content || 'No content'
			});
	}
};