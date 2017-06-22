'use strict';

const DeviceDriver = require('homey-basicdriver');
const path = require('path');

const DRIVER_TYPE = 'WHITE';

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
		light_temperature: {
			set: (device, temperature, callback) => {
				device.zone.setTemperature(temperature);
				return callback(null, temperature);
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

// Incoming flow action, night mode
Homey.manager('flow').on('action.enable_night_mode', (callback, args) => {
	if (!args.hasOwnProperty('deviceData')) return callback(new Error('invalid_parameters'));

	const device = module.exports.getDevice(args.deviceData);
	if (device instanceof Error) return callback('invalid_device');

	device.zone.enableNightMode();
	return callback(null, true);
});
