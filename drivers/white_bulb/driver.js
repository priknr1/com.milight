'use strict';

const Milight = require('node-milight');
const WifiDriver = require('node-homey-wifidriver');
const path = require('path');

const DRIVER_TYPE = "WHITE";

module.exports = new WifiDriver(path.basename(__dirname), {
	debug: true,
	initDevice: (device, callback) => {

		// Look for online bridges
		Milight.getBridges().then(() => {

			// Get bridge zone and sub zone
			const bridge = Milight.getBridge(device.data.bridgeID);
			const zone = (bridge) ? bridge.getZone(DRIVER_TYPE, device.data.zoneNumber) : undefined;

			// Check validity
			if (bridge && zone) {

				// Set available and unavailable when bridge is down
				bridge.once("offline", () => module.exports.deviceWentOffline(device));

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
			}
		},
		dim: {
			set: (device, dim, callback) => {
				device.zone.setBrightness(dim);
				return callback(null, dim);
			}
		},
		light_temperature: {
			set: (device, hue, callback) => {
				device.zone.enableWhiteMode();
				return callback(null, 0.5);
			}
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
