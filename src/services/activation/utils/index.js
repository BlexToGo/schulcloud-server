const {
	Forbidden, NotFound, BadRequest, GeneralError,
} = require('@feathersjs/errors');
const { Configuration } = require('@schul-cloud/commons');
const crypto = require('crypto');
const { HOST } = require('../../../../config/globals');
const { equal: equalIds } = require('../../../helper/compare').ObjectId;
const { getQuarantinedObject, createQuarantinedObject, KEYWORDS } = require('./customUtils');
const Mail = require('../services/interface/mailFormat');

const STATE = {
	notStarted: 'uninitiated',
	pending: 'pending',
	success: 'success',
	error: 'error',
};

const createEntry = async (ref, account, keyword, data) => {
	try {
		const quarantinedObject = createQuarantinedObject(keyword, data);
		const activationCode = crypto.randomBytes(64).toString('hex');
		const entry = await (ref.app ? ref.app : ref).service('activationModel')
			.create({
				activationCode,
				account,
				keyword,
				quarantinedObject,
			});
		return entry;
	} catch (error) {
		throw new Error('Could not create a quarantined object.');
	}
};

const deleteEntry = async (ref, entryId) => {
	try {
		await ref.app.service('activationModel').remove({ _id: entryId });
	} catch (error) {
		/* eslint-disable-next-line */
		console.error(`Entry could not be removed from the database!`);
	}
};

const setEntryState = async (ref, entryId, state) => {
	await ref.app.service('activationModel').patch({ _id: entryId }, {
		$set: {
			state,
		},
	});
};

const lookupEntry = (requestingId, entries, keyword) => {
	let filteredEntries = [];
	filteredEntries = entries.filter((entry) => equalIds(entry.account, requestingId)) || [];
	if (keyword) {
		filteredEntries = filteredEntries.find((entry) => entry.keyword === keyword) || null;
	}
	return filteredEntries;
};

const validEntry = async (entry) => {
	if (!entry) throw new NotFound('ACTIVATION_LINK_INVALID');
	if (
		Date.parse(entry.updatedAt) + 1000 * Configuration.get('ACTIVATION_LINK_PERIOD_OF_VALIDITY_SECONDS')
		< Date.now()
	) {
		await deleteEntry(this, entry._id);
		throw new BadRequest('ACTIVATION_LINK_EXPIRED');
	}
	if (entry.state !== STATE.notStarted || entry.state !== STATE.error) {
		throw new BadRequest('ACTIVATION_LINK_INVALID');
	}
};

/**
 * Will lookup entry in a activation by userId
 * @param {*} ref 					this
 * @param {ObjectId} requestingId	ObjectId of User requesting data
 * @param {String} keyword			Keyword
 */
const lookupByUserId = async (ref, requestingId, keyword = null) => {
	if (!requestingId) throw new Forbidden('Not authorized');

	const entry = await (ref.app || ref).service('activationModel').find({ query: { account: requestingId } });
	return lookupEntry(requestingId, entry, keyword);
};

/**
 * Will lookup entry in a activation by entryId
 * @param {*} ref 					this
 * @param {ObjectId} requestingId	ObjectId of User requesting data
 * @param {String} activationCode	activationCode
 * @param {String} keyword			Keyword
 */
const lookupByActivationCode = async (ref, requestingId, activationCode, keyword = null) => {
	if (!requestingId) throw new Forbidden('Not authorized');
	if (!activationCode) throw SyntaxError('entryId required!');

	const entry = await (ref.app || ref).service('activationModel').find({ query: { activationCode } });
	return lookupEntry(requestingId, entry, keyword);
};

/**
 * Will send email with informatrion from mail {email, subject, content}
 * also sets mailSend and updatedAt for entry by entryId
 * @param {*} ref				this
 * @param {Object} mail			{email, subject, content}
 * @param {ObjectId} entryId	ObjectId of entry
 */
const sendMail = async (ref, mail, entry) => {
	if (!mail || !mail.email || !mail.subject || !mail.content || !entry) throw SyntaxError('missing parameters');

	try {
		// await ref.app.service('/mails')
		// 	.create({
		// 		email: mail.email,
		// 		subject: mail.subject,
		// 		content: mail.content,
		// 	});

		await ref.app.service('activationModel').patch({ _id: entry._id }, {
			$push: {
				mailSend: Date.now(),
			},
		});
	} catch (error) {
		if (!entry.mailSend) deleteEntry(ref, entry._id);
		throw new Error('Can not send mail with activation link');
	}
};

const filterEntryParamNames = (enties, validKeys) => {
	(enties || []).forEach((entry) => {
		let data = {};
		if ('quarantinedObject' in entry) {
			data = getQuarantinedObject(entry.keyword, entry.quarantinedObject);
			delete entry.quarantinedObject;
		}
		Object.keys(entry).forEach((key) => validKeys.includes(key) || delete entry[key]);
		entry.data = data;
	});
	return enties;
};

const getUser = async (ref, userId, req = null) => {
	if (req && req.params.user) {
		return req.params.user;
	}
	const user = await ref.app.service('users').get(userId);
	return user;
};

const createActivationLink = (activationCode) => `${HOST}/activation/email/${activationCode}`;

module.exports = {
	STATE,
	KEYWORDS,
	lookupByUserId,
	lookupByActivationCode,
	setEntryState,
	sendMail,
	getUser,
	getQuarantinedObject,
	createEntry,
	deleteEntry,
	validEntry,
	createActivationLink,
	Mail,
	filterEntryParamNames,
	Forbidden,
	NotFound,
	BadRequest,
	GeneralError,
};
