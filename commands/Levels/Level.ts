import Command, { CommandData } from '../../structures/Command';
import CommandArguments from '../../structures/CommandArguments';
import Message from '../../structures/discord.js/Message';
import CommandManager from '../../util/CommandManager';
import { Responses } from '../../util/Constants';
import Util from '../../util/Util';

export default class Level extends Command {
	constructor(manager: CommandManager) {
		super(manager, {
			aliases: ['rank'],
			category: 'Levels',
			cooldown: 5,
			name: 'level',
			usages: [{
				type: 'user'
			}]
		}, __filename);
	}

	public async run(message: Message, args: CommandArguments, { send }: CommandData) {
		const user = await Util.users(message, 1) || message.author;

		const { level, xp } = await this.client.database.levels(user);

		return send(Responses.LEVEL(user, level, xp));
	}
}