'use strict';

const MilightDriver = require('./../milightDriver');

class MilightRGBWDriver extends MilightDriver {
	onInit() {
		super.onInit({
			driverType: 'RGBW',
		});
	}
}

module.exports = MilightRGBWDriver;
