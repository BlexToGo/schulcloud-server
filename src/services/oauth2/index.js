const { static: staticContent } = require('@feathersjs/express');
const path = require('path');

const hooks = require('./hooks');
const Hydra = require('./hydra.js');

const setClientDefaults = (data) => {
	data.scope = data.scope || 'openid offline';
	data.grant_types = data.grant_types || ['authorization_code', 'refresh_token'];
	data.response_types = data.response_types || ['code', 'token', 'id_token'];
	data.redirect_uris = data.redirect_uris || [];
	return data;
};

module.exports = function oauth2() {
	const app = this;
	const hydraAdmin = Hydra(app.settings.services.hydra);

	// hydra.isInstanceAlive()
	// 	.then(res => { logger.log('info', 'Hydra status is: ' + res.statusText) })
	// 	.catch(error => { logger.log('warn', 'Hydra got a problem: ' + error) });

	app.use('/oauth2/api', staticContent(path.join(__dirname, '/docs/openapi.yaml')));

	app.use('/oauth2/baseUrl', {
		find() {
			return Promise.resolve(app.settings.services.hydra);
		},
	});

	app.use('/oauth2/clients', {
		find(params) {
			return hydraAdmin.listOAuth2Clients(params);
		},
		get(id) {
			return hydraAdmin.getOAuth2Client(id);
		},
		create(data) {
			return hydraAdmin.createOAuth2Client(setClientDefaults(data));
		},
		update(id, data) {
			return hydraAdmin.updateOAuth2Client(id, setClientDefaults(data));
		},
		remove(id) {
			return hydraAdmin.deleteOAuth2Client(id);
		},
	});
	app.service('/oauth2/clients').hooks(hooks.hooks.clients);

	app.use('/oauth2/loginRequest', {
		get(challenge) {
			return hydraAdmin.getLoginRequest(challenge);
		},
		patch(challenge, body, params) {
			return params.query.accept
				? hydraAdmin.acceptLoginRequest(challenge, body)
				: hydraAdmin.rejectLoginRequest(challenge, body);
		},
	});
	app.service('/oauth2/loginRequest').hooks(hooks.hooks.loginRequest);

	app.use('/oauth2/logoutRequest', {
		patch(challenge, body) {
			return hydraAdmin.acceptLogoutRequest(challenge, body);
		},
	});
	app.service('/oauth2/logoutRequest').hooks(hooks.hooks.logoutRequest);

	app.use('/oauth2/consentRequest', {
		get(challenge) {
			return hydraAdmin.getConsentRequest(challenge);
		},
		patch(challenge, body, params) {
			return params.query.accept
				? hydraAdmin.acceptConsentRequest(challenge, body)
				: hydraAdmin.rejectConsentRequest(challenge, body);
		},
	});
	app.service('/oauth2/consentRequest').hooks(hooks.hooks.consentRequest);

	app.use('/oauth2/introspect', {
		create(data) {
			return hydraAdmin.introspectOAuth2Token(data.token, 'openid');
		},
	});
	app.service('/oauth2/introspect').hooks(hooks.hooks.introspect);

	app.use('/oauth2/auth/sessions/consent', {
		get(user) {
			return hydraAdmin.listConsentSessions(user);
		},
		remove(user, params) {
			return hydraAdmin.revokeConsentSession(user, params.query.client);
		},
	});
	app.service('/oauth2/auth/sessions/consent').hooks(hooks.hooks.consentSessions);
};
