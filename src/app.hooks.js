// Global hooks that run for every service
const sanitizeHtml = require('sanitize-html');

/**
 * Strips JS Code from an object/array/string and returns clean version of it
 * @param data {object/array/string}
 * @returns data - clean without JS
 */
const stripDeepJs = (data) => {
	if (typeof data === "object" && data !== null) {
		Object.entries(data).forEach(([key, value]) => {
			if(typeof value === "string")
				data[key] = sanitizeHtml(value);
			else if (Array.isArray(value))
				stripDeepJs(value);
			else if (typeof value === "object")
				stripDeepJs(value);
		});
	} else if (typeof data === "string")
		data = sanitizeHtml(data);
	else if (Array.isArray(data)) {
		for (let i = 0; i < data.length; i++) {
			if (typeof data[i] === "string") {
				data[i] = sanitizeHtml(data[i]);
			} else if (Array.isArray(data[i])) {
				stripDeepJs(data[i]);
			} else if (typeof data[i] === "object") {
				stripDeepJs(data[i]);
			}
		}
	}
	return data;
};

const stripJsUniversal = (hook) => {
	if (hook.data && hook.path && hook.path !== "authentication") {
		stripDeepJs(hook.data);
	}
	return hook;
};

module.exports = {
	before: {
		all: [],
		find: [],
		get: [],
		create: [stripJsUniversal],
		update: [stripJsUniversal],
		patch: [stripJsUniversal],
		remove: []
	},
	
	after: {
		all: [],
		find: [],
		get: [],
		create: [],
		update: [],
		patch: [],
		remove: []
	}
};
