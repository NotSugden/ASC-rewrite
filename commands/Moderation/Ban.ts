import { APIInteractionResponseType, MessageFlags } from 'discord-api-types/v8';
import { Permissions, BanOptions, Snowflake } from 'discord.js';
import Command, { CommandData, CommandCategory, InteractionResponse } from '../../structures/Command';
import CommandArguments from '../../structures/CommandArguments';
import Interaction from '../../structures/Interaction';
import CommandError from '../../util/CommandError';
import CommandManager from '../../util/CommandManager';
import { CommandErrors, Responses } from '../../util/Constants';
import { GuildMessage } from '../../util/Types';
import Util from '../../util/Util';

export default class Ban extends Command {
	constructor(manager: CommandManager) {
		super(manager, {
			aliases: ['🔨', '🍌',{
				append: ['--soft=true'],
				name: ['softban', 'soft-ban']
			}, {
				append: ['--days=7'],
				name: ['ban7', 'ban-7']
			}],
			category: CommandCategory.MODERATION,
			cooldown: 5,
			examples: [
				'{author} Being too cool!',
				'{author.id} Being too fancy!',
				'{author} {randomuserid} Trollers!',
				'{alias:3} {author} Spamming',
				'{alias:4} {author} Banned, with your messages deleted!'
			],
			name: 'ban',
			permissions: member => {
				const config = member.guild.config;
				if (!config) return null;
				const hasAccess = config.accessLevelRoles.slice(1).some(
					roleID => member.roles.cache.has(roleID)
				);
				if (
					hasAccess || member.hasPermission(Permissions.FLAGS.ADMINISTRATOR)
				) return true;
        
				return false;
			}
		}, __filename);
	}

	public async run(message: GuildMessage<true>, args: CommandArguments, { send }: CommandData) {
		await message.delete();
		const { users, reason, flags, members } = await Util.reason(message, {
			argsOverload: args.regular, fetchMembers: true, withFlags: [{
				name: 'days',
				type: 'number'
			}, {
				name: 'silent',
				type: 'boolean'
			}, {
				name: 'soft',
				type: 'boolean'
			}]
		});

		if (!reason) throw new CommandError('PROVIDE_REASON');
		if (!users.size) throw new CommandError('MENTION_USERS');

		const notManageable = members.filter(member => !Util.manageable(member, message.member!));
		if (notManageable.size) throw new CommandError(
			'CANNOT_ACTION_USER', 'BAN', members.size > 1
		);

		const extras: { [key: string]: string } = { };

		const banOptions = {} as BanOptions;

		if (flags.soft) {
			banOptions.days = 7;
		}

		if (typeof flags.days === 'number') {
			const { days } = flags;
			if (days < 1 || days > 7) {
				throw new CommandError(
					'INVALID_FLAG_TYPE',
					'days', 'an integer bigger than 0 and lower than 8'
				);
			}
			banOptions.days = days;
			extras['Days of Messages Deleted'] = days.toString();
		}

		const alreadyBanned = users
			.filter(user => message.guild.bans.has(user.id))
			.map(user => message.guild.bans.get(user.id)!);
		if (alreadyBanned.length) {
			if (alreadyBanned.length === users.size) {
				throw new CommandError('ALREADY_REMOVED_USERS', users.size > 1, false);
			}
			extras.Note =
					`${alreadyBanned.length} Other user${
						alreadyBanned.length > 1 ? 's were' : ' was'
					} attempted to be banned, however they were already banned.`;
		}

		const filteredUsers = users.array().filter(user => !alreadyBanned.some(data => data.user.id === user.id));

		let context: GuildMessage<true> | undefined;

		if (!flags.silent) {
			context = await send(Responses.MEMBER_REMOVE_SUCCESSFUL({
				filteredUsers, users: users.array()
			}, false));
		}
		
		const { id: caseID } = await Util.sendLog({
			action: flags.soft ? 'SOFT_BAN' : 'BAN',
			context,
			extras,
			guild: message.guild,
			moderator: message.author,
			reason,
			screenshots: [],
			users: filteredUsers
		});

		banOptions.reason = Responses.AUDIT_LOG_MEMBER_REMOVE(message.author, caseID, false);

		for (const user of filteredUsers) {
			message.guild.bans.set(user.id, {
				reason: banOptions.reason,
				user
			});
			try {
				await user.send(Responses.DM_PUNISHMENT_ACTION(
					message.guild,
					// TS is freaking out about 'BAN' being incompatible with 'WARN'...?
					(flags.soft ? 'SOFT_BAN' : 'BAN') as 'WARN',
					reason
				));
			} catch { } // eslint-disable-line no-empty
			await message.guild.members.ban(user, banOptions);
			if (flags.soft) {
				await message.guild.members.unban(user.id);
			}
		}

		return context;
	}

	public async interaction(interaction: Interaction): Promise<InteractionResponse> {
		const days = <number | undefined> interaction.options!.find(opt => opt.name === 'days')?.value;
		const userID = <Snowflake> interaction.options!.find(opt => opt.name === 'user')!.value;
		const member = interaction.resolved!.members!.get(userID)!;
		const { guild } = interaction;

		if (!Util.manageable(member, interaction.member)) {
			return { data: {
				content: CommandErrors.CANNOT_ACTION_USER('BAN', false),
				flags: MessageFlags.EPHEMERAL
			}, type: APIInteractionResponseType.ChannelMessageWithSource };
		}

		const extras: Record<string, string> = {};

		if (days) {
			extras['Days of Messages Deleted'] = days.toString();
		}

		const { id: caseID, reason } = await Util.sendLog({
			action: 'BAN',
			extras,
			guild,
			moderator: interaction.member.user,
			reason: <string> interaction.options!.find(opt => opt.name === 'reason')!.value,
			screenshots: [],
			users: [member.user]
		});

		await member.ban({
			days, reason: Responses.AUDIT_LOG_MEMBER_REMOVE(interaction.member.user, caseID, false)
		});

		return { data: {
			content: `Banned ${member.user.tag} for reason ${reason}.`,
			flags: MessageFlags.EPHEMERAL
		}, type: APIInteractionResponseType.ChannelMessageWithSource };
	}
}