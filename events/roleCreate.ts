import { Events } from '../util/Client';

export default (async role => {
	const { guild, client } = role;
	const config = client.config.guilds.has(guild.id);
	if (!config || role.permissions.bitfield !== guild.roles.everyone.permissions.bitfield) return;
	await role.setPermissions(0, 'New role permissions fix');
}) as (...args: Events['roleCreate']) => void;