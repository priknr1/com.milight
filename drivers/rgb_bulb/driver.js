'use strict';

const Milight = require('./../../lib/node-milight');
const WifiDriver = require('homey-wifidriver');
const color = require('onecolor');
const path = require('path');

const DRIVER_TYPE = "RGB";

module.exports = new WifiDriver(path.basename(__dirname), {
	initDevice: (device, callback) => {

		// Look for online bridges
		Milight.getBridges().then(() => {

			// Get bridge zone and sub zone
			const bridge = Milight.getBridge(device.data.bridgeID);
			const zone = (bridge) ? bridge.getZone(DRIVER_TYPE, device.data.zoneNumber) : undefined;

			// Check validity
			if (bridge && zone) {

				// Set available and unavailable when bridge is down
				bridge.once("offline", () => device.markAsUnavailable());

				// Store additional properties
				device.name = zone.name;
				device.zone = zone;
				device.bridge = bridge;

				return callback(null, device);
			}

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
				device.zone.setHue(hue);
				return callback(null, hue);
			},
			persistOverReboot: true,
		}
	},
	pair: socket => {
		socket.on("list_devices", (data, callback) => {
			Milight.getBridges().then(bridges => {
				const results = [];
				for (let i = 0; i < bridges.length; i++) {
					const zones = bridges[i].getZones(DRIVER_TYPE);
					for (let j = 0; j < zones.length; j++) {
						results.push({
							name: `Bridge ${parseInt(i) + 1} ${zones[j].name}`,
							data: {
								id: zones[j].id,
								bridgeID: bridges[i].id,
								bridgeIP: bridges[i].ip,
								zoneNumber: parseInt(j) + 1
							}
						});
					}
				}
				return callback(null, results);
			}).catch(err => callback(err, false));
		});
	}
});

// Incoming flow action, set color
Homey.manager('flow').on('action.set_color_rgb', (callback, args) => {
	if (!args.hasOwnProperty('deviceData') || !args.hasOwnProperty('color')) return callback(new Error('invalid_parameters'));

	// Construct color object
	const myColor = color(args.color);
	args.color = myColor.hue();

	module.exports.capabilities.light_hue.set(args.deviceData, args.color, (err, result) => callback(null, true));
});
