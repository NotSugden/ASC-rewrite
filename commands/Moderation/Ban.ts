import { Permissions, BanOptions } from 'discord.js';
import Command, { CommandData } from '../../structures/Command';
import CommandArguments from '../../structures/CommandArguments';
import Message from '../../structures/discord.js/Message';
import CommandError from '../../util/CommandError';
import CommandManager from '../../util/CommandManager';
import { Responses } from '../../util/Constants';
import Util from '../../util/Util';

export default class Ban extends Command {
	constructor(manager: CommandManager) {
		super(manager, {
			aliases: ['🔨', '🍌', '<:ASC_yeet:539506595239952409>'],
			category: 'Moderation',
			cooldown: 5,
			name: 'ban',
			permissions: member => {
				if (member.guild.id !== member.client.config.defaultGuildID) return false;
				if (
					// Checking for the `Chat Moderator` role
					member.roles.cache.has('539355587839000588') ||
					member.hasPermission(Permissions.FLAGS.ADMINISTRATOR)
				) return true;
				return false;
			},
			usages: [{
				required: true,
				type: 'user'
			}, {
				type: '--days=7'
			}, {
				required: true,
				type: 'reason'
			}]
		}, __filename);
	}

	public async run(message: Message, args: CommandArguments, { send }: CommandData) {
		await message.delete();
		const { users, reason, flags, members } = await Util.reason(message, {
			fetchMembers: true, withFlags: [{
				name: 'days',
				type: 'number'
			}, {
				name: 'silent',
				type: 'boolean'
			}]
		});
			
		// have to non-null assert it
		const guild = message.guild!;

		if (!reason) throw new CommandError('PROVIDE_REASON');
		if (!users.size) throw new CommandError('MENTION_USERS');

		const notManageable = members.filter(member => !Util.manageable(member, message.member!));
		if (notManageable.size) throw new CommandError(
			'CANNOT_ACTION_USER', 'BAN', members.size > 1
		);

		const extras: {
				[key: string]: unknown;
				reason: string;
			} = { reason };

		const banOptions = {} as BanOptions;

		if (typeof flags.days === 'number') {
			const { days } = flags;
			if (days < 1 || days > 7 ) {
				throw new CommandError(
					'INVALID_FLAG_TYPE',
					'days', 'an integer bigger than 0 and lower than 8'
				);
			}
			banOptions.days = days;
			extras['Days of Messages Deleted'] = days.toString();
		}

		const alreadyBanned = users
			.filter(user => guild.bans.has(user.id))
			.map(user => guild.bans.get(user.id)!);
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

		const { id: caseID } = await Util.sendLog(
			message.author,
			filteredUsers,
			'BAN',
			extras
		);

		banOptions.reason = Responses.AUDIT_LOG_MEMBER_REMOVE(message.author, caseID, false);

		for (const user of filteredUsers) {
			guild.bans.set(user.id, {
				reason: banOptions.reason,
				user
			});
			await guild.members.ban(user, banOptions);
		}

		if (!flags.silent) {
			return send(Responses.MEMBER_REMOVE_SUCCESSFUL({
				filteredUsers, users: users.array()
			}, false));
		}
	}
}