'use strict';

const MilightDriver = require('./../milightDriver');

class MilightRGBDriver extends MilightDriver {
	onInit() {
		super.onInit({
			driverType: 'RGB',
		});
	}
}

module.exports = MilightRGBDriver;
