import { Client, Snowflake } from 'discord.js';
import { CommandErrors, Responses } from '../util/Constants';
import { GuildMessage, TextBasedChannels } from '../util/Types';
import Util from '../util/Util';

export default class Giveaway {
	public client!: Client;
	public channelID: Snowflake;
	public createdByID: Snowflake;
	public endTimestamp: number;
	public messageID: Snowflake;
	public messageRequirement!: number | null;
	public prize!: string;
	public requirement!: string | null;
	public startTimestamp: number;
	public winnerIDs!: Snowflake[] | null;

	constructor(client: Client, data: RawGiveaway) {
		Object.defineProperty(this, 'client', { value: client });

		this.startTimestamp = new Date(data.start).getTime();
		this.endTimestamp = new Date(data.end).getTime();

		this.channelID = data.channel_id;
		this.createdByID = data.created_by;
		this.messageID = data.message_id;
		this.patch(data);
	}

	public patch(data: Partial<Omit<RawGiveaway, 'winners'>> & { winners?: string | Snowflake[] | null}) {
		if (typeof data.prize === 'string') {
			this.prize = Util.decrypt(data.prize, this.client.config.encryptionPassword).toString();
		}
		if (data.winners === null) this.winnerIDs = null;
		else if (typeof data.winners !== 'undefined') {
			this.winnerIDs = typeof data.winners === 'string'
				? JSON.parse(data.winners)
				: data.winners;
		}
		if (data.message_requirement === null) this.messageRequirement = null;
		else if (typeof data.message_requirement === 'number') {
			this.messageRequirement = data.message_requirement;
		}
		if (data.requirement === null) this.requirement = null;
		else if (typeof data.requirement === 'string') {
			this.requirement = Util.decrypt(data.requirement, this.client.config.encryptionPassword).toString();
		}
	}

	get channel() {
		return this.client.channels.resolve(this.channelID) as TextBasedChannels;
	}

	public async end() {
		const message = await this.fetchMessage();
		const reaction = message.reactions.cache.get('🎁');
		if (!reaction) {
			await message.edit(Responses.GIVEAWAY_END(this.prize, this.endAt));
			await this.setWinners([]);
			return message.channel.send(CommandErrors.NO_GIVEAWAY_WINNERS(
				this.prize
			));
		}
		const entries = await reaction.users.fetch();
		entries.delete(this.client.user!.id);
		if (this.messageRequirement) {
			const config = (await message.guild.fetchConfig())!;
			for (const user of entries.values()) {
				const [{ count }] = await this.client.database.query<{ count: number }>(
					'SELECT COUNT(*) AS count FROM messages WHERE ' +
					'sent_timestamp > :sent AND channel_id = :channelID AND user_id = :userID',
					{ channelID: config.generalChannelID, sent: new Date(this.startAt), userID: user.id }
				);
				if (count < this.messageRequirement) entries.delete(user.id);
			}
		}
		if (entries.size === 0) {
			await message.edit(Responses.GIVEAWAY_END(this.prize, this.endAt));
			await this.setWinners([]);
			return message.channel.send(CommandErrors.NO_GIVEAWAY_WINNERS(
				this.prize, this.messageRequirement !== null
			)) as Promise<GuildMessage<true>>;
		}
		const winner = entries.random();
		await this.setWinners([winner.id]);
		this.client.database.cache.giveaways.clearTimeout(this.messageID);
		await message.edit(Responses.GIVEAWAY_END(this.prize, this.endAt, [winner]));
		return message.channel.send(Responses.WON_GIVEAWAY(winner, this.prize, message)) as Promise<GuildMessage<true>>;
	}

	get endAt() {
		return new Date(this.endTimestamp);
	}

	get ended() {
		return this.endAt.getTime() > Date.now() && this.winnerIDs !== null;
	}

	public fetchWinners(cache = true) {
		if (!this.winnerIDs) {
			throw new Error('WINNERS_NOT_CHOSEN');
		}
		return Promise.all(this.winnerIDs.map(winnerID => this.client.users.fetch(winnerID, cache)));
	}

	public fetchMessage(cache = false) {
		return this.channel.messages.fetch(this.messageID, cache) as Promise<GuildMessage<true>>;
	}
	
	get startAt() {
		return new Date(this.startTimestamp);
	}

	get winners() {
		return this.winnerIDs
			? this.winnerIDs.map(winnerID => this.client.users.resolve(winnerID))
			: null;
	}

	public setWinners(userIDs: Snowflake[]) {
		return this.client.database.editGiveaway(this.messageID, { winners: userIDs });
	}
}

export interface RawGiveaway {
	created_by: Snowflake;
	prize: string;
	message_id: Snowflake; 
	channel_id: Snowflake;
	start: Date;
	end: Date;
	winners: string | null;
	message_requirement: number | null;
	requirement: string | null;
}