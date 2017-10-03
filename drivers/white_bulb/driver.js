'use strict';

const MilightDriver = require('./../milightDriver');

class MilightWHITEDriver extends MilightDriver {
	onInit() {
		super.onInit({
			driverType: 'WHITE',
		});
	}
}

module.exports = MilightWHITEDriver;
