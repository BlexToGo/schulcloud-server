const mongoose = require('mongoose');
// eslint-disable-next-line no-unused-vars
const { alert, error } = require('../src/logger');

const { connect, close } = require('../src/utils/database');

const Roles = mongoose.model(
	'roles200735',
	new mongoose.Schema(
		{
			name: { type: String, required: true },
			permissions: [{ type: String }],
		},
		{
			timestamps: true,
		}
	),
	'roles'
);

module.exports = {
	up: async function up() {
		await connect();

		await Roles.updateOne(
			{ name: 'user' },
			{
				$pull: {
					permissions: {
						$in: ['SYSTEM_VIEW'],
					},
				},
			}
		).exec();
		alert(`Permission SYSTEM_VIEW removed from role user`);

		await close();
	},

	down: async function down() {
		await connect();

		await Roles.updateOne(
			{ name: 'user' },
			{
				$addToSet: {
					permissions: {
						$each: ['SYSTEM_VIEW'],
					},
				},
			}
		).exec();
		alert(`Permission SYSTEM_VIEW added to role user`);

		await close();
	},
};