'use strict';

const MilightDriver = require('./../milightDriver');

class MilightRGBWWDriver extends MilightDriver {
	onInit() {
		super.onInit({
			driverType: 'RGBWW',
		});
	}
}

module.exports = MilightRGBWWDriver;
