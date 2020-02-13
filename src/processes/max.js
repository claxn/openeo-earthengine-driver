const { BaseProcess } = require('@openeo/js-processgraphs');
const Commons = require('../processgraph/commons');

module.exports = class max extends BaseProcess {

	async execute(node) {
		return Commons.reduceInCallback(node, 'max');
	}

};