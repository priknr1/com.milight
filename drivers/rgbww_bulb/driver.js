'use strict';

const DeviceDriver = require('homey-basicdriver');
const onecolor = require('onecolor');
const path = require('path');

const DRIVER_TYPE = 'RGBWW';

module.exports = new DeviceDriver(path.basename(__dirname), {
	initDevice: (device, callback) => {
		console.log(`initDevice -> id: ${device.data.id}`);

		// Look for online bridges
		Homey.app.BridgeManager.findBridge(device.data.bridgeID).then(bridge => {

			Homey.app.BridgeManager.registerBridge(bridge, false);

			bridge.registerDevice(device.data.id);

			device.on('destroy', () => {
				bridge.deregisterDevice(device.data.id);
			});

			// Get bridge zone and sub zone
			const zone = (bridge) ? bridge.getZone(DRIVER_TYPE, device.data.zoneNumber) : undefined;

			// Check validity
			if (bridge && zone) {

				// Set available and unavailable when bridge is down
				bridge.on('offline', () => {
					module.exports.setUnavailable(device.data, __('no_response'));
				}).on('online', () => {
					device.emit('reinit');
				});

				// Store additional properties
				device.name = zone.name;
				device.zone = zone;
				device.bridge = bridge;

				return callback(null, device);
			}

			console.log(`initDevice -> id: ${device.data.id} -> failed`);

			return callback(new Error('initialization_failed'));
		}).catch(err => {
			console.error(err.stack);
			return callback(new Error('initialization_failed'));
		});
	},
	capabilities: {
		onoff: {
			set: (device, onoff, callback) => {
				onoff ? device.zone.turnOn() : device.zone.turnOff();
				return callback(null, onoff);
			},
			persistOverReboot: true,
		},
		dim: {
			set: (device, dim, callback) => {
				device.zone.setBrightness(dim);
				return callback(null, dim);
			},
			persistOverReboot: true,
		},
		light_hue: {
			set: (device, hue, callback) => {
				if (device.settings.invert_red_and_green.get() === true) {
					const red = onecolor(`hsl(${hue * 360}, 1, 1)`).red();
					const green = onecolor(`hsl(${hue * 360}, 1, 1)`).green();
					const blue = onecolor(`hsl(${hue * 360}, 1, 1)`).blue();
					const color = onecolor(`rgb(${green},${red},${blue})`);
					device.zone.setHue(calibrateHue(color.hue(), device.settings.hue_calibration.get()));
				} else device.zone.setHue(calibrateHue(hue, device.settings.hue_calibration.get()));
				module.exports.realtime(device.data, 'light_mode', 'color');
				return callback(null, hue);
			},
			persistOverReboot: true,
		},
		light_temperature: {
			set: (device, temperature, callback) => {
				device.zone.setTemperature(temperature);
				module.exports.realtime(device.data, 'light_mode', 'temperature');
				return callback(null, temperature);
			},
			persistOverReboot: true,
		},
		light_mode: {
			set: (device, mode, callback) => {
				if (mode === 'temperature') {
					device.zone.enableWhiteMode(device.capabilities.light_temperature.get());
					return callback(null, mode);
				} else if (mode === 'color') {
					module.exports.capabilities.light_hue.set(device.data, device.capabilities.light_hue.get(), (err, result) => callback(err, mode));
				} else if (mode === 'disco') {
					module.exports.capabilities.light_mode.set(device.data, 'color', (err, result) => {
						device.zone.toggleScene();
						return callback(err, result);
					});
				} else if (mode === 'night') {
					device.zone.enableNightMode();
					return callback(null, mode);
				} else if (typeof mode === 'number') {
					device.zone.toggleScene(mode);
					return callback(null, mode);
				}
			},
			persistOverReboot: true,
		},
	},
	pair: socket => {
		socket.on('list_devices', (data, callback) => {
			Homey.app.BridgeManager.discoverBridges({ temp: true }).then(bridges => {
				const results = [];
				for (let i = 0; i < bridges.length; i++) {
					const zones = bridges[i].getZones(DRIVER_TYPE);
					for (let j = 0; j < zones.length; j++) {
						results.push({
							name: (bridges[i].bridgeVersion === 6) ? `iBox Bridge ${parseInt(i) + 1} ${zones[j].name}` : `Bridge ${parseInt(i) + 1} ${zones[j].name}`,
							data: {
								id: zones[j].id,
								bridgeID: bridges[i].mac,
								bridgeIP: bridges[i].ip,
								zoneNumber: parseInt(j) + 1,
							},
						});
					}
				}
				return callback(null, results);
			}).catch(err => callback(err, false));
		});
		socket.on('disconnect', () => {
			// Remove left over bridges after a safe time
			setTimeout(() => {
				Homey.app.BridgeManager.deregisterTempBridges();
			}, 30000);
		});
	},
});

// Incoming flow action, white mode
Homey.manager('flow').on('action.white_mode', (callback, args) => {
	if (!args.hasOwnProperty('deviceData')) return callback(new Error('invalid_parameters'));
	module.exports.capabilities.light_mode.set(args.deviceData, 'temperature', (err, result) => callback(null, true));
});

// Incoming flow action, disco mode
Homey.manager('flow').on('action.disco_mode', (callback, args) => {
	if (!args.hasOwnProperty('deviceData')) return callback(new Error('invalid_parameters'));
	module.exports.capabilities.light_mode.set(args.deviceData, 'disco', (err, result) => callback(null, true));
});

// Incoming flow action, disco mode
Homey.manager('flow').on('action.disco_mode_specific', (callback, args) => {
	if (!args.hasOwnProperty('deviceData')) return callback(new Error('invalid_parameters'));
	module.exports.capabilities.light_mode.set(args.deviceData, Number(args.mode), (err, result) => callback(null, true));
});

// Incoming flow action, night mode
Homey.manager('flow').on('action.enable_night_mode', (callback, args) => {
	if (!args.hasOwnProperty('deviceData')) return callback(new Error('invalid_parameters'));
	module.exports.capabilities.light_mode.set(args.deviceData, 'night', (err, result) => callback(null, true));
});

// Incoming flow action, set onecolor
Homey.manager('flow').on('action.set_color_rgbww', (callback, args) => {
	if (!args.hasOwnProperty('deviceData') || !args.hasOwnProperty('color')) return callback(new Error('invalid_parameters'));
	const myColor = onecolor(args.color);
	args.color = myColor.hue();
	module.exports.capabilities.light_hue.set(args.deviceData, args.color, (err, result) => callback(null, true));
});

/**
 * Calibrate hue value, to keep
 * value in hue range of 0 - 1
 * @param hue
 * @param value
 * @returns {number}
 */
function calibrateHue(hue, value) {
	hue = hue + value;
	if (hue > 1) return hue - 1;
	if (hue < 0) return hue + 1;
	return hue;
}
