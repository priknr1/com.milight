'use strict';

// TODO bridge pairing wizard
// TODO oibackoff like onInit() retry
// TODO after updateIP() update zones in device object, they still refer to older zones with wrong session ids

const Homey = require('homey');
const Log = require('homey-log').Log;

const BridgeManager = require('./lib/milight/BridgeManager.js');

class MilightApp extends Homey.HomeyApp {
	onInit() {
		this.log(`${this.id} running...`);
		this._BridgeManager = new BridgeManager();
	}

	get BridgeManager() {
		return this._BridgeManager;
	}
}

module.exports = MilightApp;
