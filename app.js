'use strict';

// TODO bridge pairing wizard
// TODO maybe SDKv2

const Log = require('homey-log').Log;

const BridgeManager = require('./lib/milight/BridgeManager.js');

module.exports.init = () => {
	console.log(`${Homey.manifest.id} running...`);
	module.exports.BridgeManager = new BridgeManager();
};
