/* eslint-disable consistent-return */
import { promises as fs } from 'fs';
import { join } from 'path';
import { MessageOptions, MessageEditOptions } from 'discord.js';
import fetch from 'node-fetch';
import { CommandData } from '../structures/Command';
import CommandArguments from '../structures/CommandArguments';
import Message from '../structures/discord.js/Message';
import { Responses } from '../util/Constants';
import Util from '../util/Util';
export default async (message: Message) => {
	try {
		const { client } = message;
		const edited = Boolean(message.editedTimestamp);
		if (
			message.author.bot ||
			message.channel.type === 'dm'
		) return;
		if (message.guild!.id === client.config.defaultGuildID) {
			if (client.config.attachmentLogging && !edited && message.attachments.size) {
				const urls = message.attachments.map(({ url }) => url);
				/* eslint-disable no-await-in-loop */
				for (let i = 0; i < urls.length; i++) {
					const url = urls[i];
					const extension = url.split('.').pop();
					const name = join(
						client.config.filesDir,
						`${message.id}-${i}${extension ? `.${extension}` : ''}`,
					);
					const buffer = await fetch(url)
						.then(response => response.buffer())
						.then(data => Util.encrypt(data, client.config.encryptionPassword));
					await fs.writeFile(name, buffer);
				}
				/* eslint-enable no-await-in-loop */
			}
		}
		if (!message.content.startsWith(client.config.prefix)) return;
		const [plainCommand] = message.content.slice(1).split(' ');
		const args = new CommandArguments(message);
		const command = client.commands.resolve(plainCommand);
		if (!command) return;
		const { permissions } = command;
		const send: CommandData['send'] = async (content, options) => {
			if (typeof message.commandID === 'string') {
				const msg = message.channel.messages.cache.get(message.commandID);
				// Lazy fix here casting it to MessageEditOptions, TS complains otherwise.
				if (msg) return msg.edit(content, options as MessageEditOptions) as Promise<Message>;
			}

			// Lazy fix here casting it to MessageOptions, TS complains otherwise.
			const msg = await message.channel.send(content, (options as MessageOptions)) as Message;
			message.commandID = msg.id;
			return msg;
		};
		let hasPermissions: boolean;
		if (typeof permissions === 'function') {
			hasPermissions = await permissions(message.member!, message.channel);
		} else {
			hasPermissions = message.member!.hasPermission(permissions);
		}
		if (!hasPermissions) return send(Responses.INSUFFICIENT_PERMISSIONS);

		await command.run(message, args, {
			edited,
			send,
		});
	} catch (error) {
		await message.channel.send([
			`An unexpected error has occoured: \`${error.name}\``,
			`\`\`\`js\n${error.message}\`\`\``,
		], {
			files: [
				'https://cdn.discordapp.com/attachments/594924795632549908/687837066058399780/Icons8_flat_delete_generic.png',
			],
		}).catch(console.error);
		console.error(error);
	}
};
