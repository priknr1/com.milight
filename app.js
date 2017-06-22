'use strict';

// TODO RGBWW driver
// TODO refactor legacy bridge to use node-milight-promise
// TODO multiple initDevice calls?
// TODO test migration from old to new
// TODO set specific effect mode should not be available for legacy rgbw
// TODO online/offline
// TODO emit onoff when using dim slider to turn on/off a bulb

// TODO legacy rgbw hue is wrong

// TODO RGBWW icons images

// DONE checked RGB driver with legacy bridge AOK
// DONE checked RGBW driver with lagacy bridge OK, except for wrong hue values or maybe rgb not sure


const Log = require('homey-log').Log;

const BridgeManager = require('./lib/milight/BridgeManager.js');

module.exports.init = () => {
	console.log(`${Homey.manifest.id} running...`);
	module.exports.BridgeManager = new BridgeManager();
};
