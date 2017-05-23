'use strict';

// TODO RGBWW driver
// TODO refactor legacy bridge to use node-milight-promise
// TODO multiple initDevice calls?
// TODO after Unavailable/Available this.light is not properly working
// TODO test migration from old to new

const Log = require('homey-log').Log;

const MilightManager = require('./lib/milight/Milight.js');

module.exports.init = () => {
	console.log(`${Homey.manifest.id} running...`);
	module.exports.BridgeManager = new MilightManager();
};
