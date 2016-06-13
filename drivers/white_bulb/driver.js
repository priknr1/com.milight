"use strict";
const Milight = require('node-milight');

const DRIVER_TYPE = "WHITE";

var devices = [];

/**
 * On init of the driver start listening for bridges that
 * were found and try to connect installed devices
 * @param devices_homey
 * @param callback
 */
module.exports.init = function (devices_data, callback) {

	// Loop trough all registered devices
	devices_data.forEach(function (device_data) {

		// Mark by default as offline on reboot
		module.exports.setUnavailable(device_data, "Offline");
	});

	// Look for online bridges
	Milight.getBridges().then(()=> {

		// Loop trough all registered devices
		devices_data.forEach(function (device_data) {

			// Get bridge zone and sub zone
			var bridge = Milight.getBridge(device_data.bridgeID);
			var zone = bridge.getZone(DRIVER_TYPE, device_data.zoneNumber);

			// Check validity
			if (bridge && zone) {

				// Set available and unavailable when bridge is down
				bridge.on("offline", function () {
					module.exports.setUnavailable(device_data, "Offline");
				}).on("online", function () {
					module.exports.setAvailable(device_data);
				});

				// Store device
				devices.push({
					name: zone.name,
					data: device_data,
					zone: zone,
					bridge: bridge
				});

				// Mark by default as offline on reboot
				module.exports.setAvailable(device_data);
			}
			else {

				// Start pinging bridge
				Milight.pingBridge(device_data.bridgeIP);
			}
		})
	});

	// Successful start of driver
	callback(null, true);
};

/**
 * Object below constructs the pairing process of the RGBW bulb
 * @param socket Connection to the front-end
 */
module.exports.pair = function (socket) {

	// Listing devices
	socket.on("list_devices", function (data, callback) {

		// Get milight bridges
		Milight.getBridges().then(bridges => {
			var results = [];

			// Loop over bridges
			for (let i in bridges) {
				let zones = bridges[i].getZones(DRIVER_TYPE);

				// Loop over zones
				for (let j in zones) {
					let zone = zones[j];

					results.push({
						name: `Bridge ${parseInt(i) + 1} ${zone.name}`,
						data: {
							id: zone.id,
							bridgeID: bridges[i].id,
							bridgeIP: bridges[i].ip,
							zoneNumber: parseInt(j) + 1
						}
					})
				}
			}

			// Callback results
			callback(null, results);

		}).catch(err => {

			// Callback error
			callback(err, false);
		});
	});

	// Add selected device
	socket.on("add_device", function (device, callback) {

		// Get bridge zone and sub zone
		var bridge = Milight.getBridge(device.data.bridgeID);
		var zone = bridge.getZone(DRIVER_TYPE, device.data.zoneNumber);

		// Check validity
		if (bridge && zone) {

			// Set available and unavailable when bridge is down
			bridge.on("offline", function () {
				module.exports.setUnavailable(device.data, "Offline");
			}).on("online", function () {
				module.exports.setAvailable(device.data);
			});

			// Store device
			devices.push({
				name: zone.name,
				data: device.data,
				zone: zone,
				bridge: bridge
			});

			// Return success
			callback(null, device);
		}
		else {
			callback(true, false);
		}
	});
};

/**
 * Below the capabilites of the Milight RGBW bulb are constructed
 */
module.exports.capabilities = {

	onoff: {
		get: function (device_data, callback) {
			if (device_data instanceof Error) return callback(device_data);

			var device = getDevice(device_data.id);
			if (device) {
				callback(null, device.zone.status == "on");
			}
			else {
				callback(true, null);
			}
		},

		set: function (device_data, onoff, callback) {
			if (device_data instanceof Error) return callback(device_data);

			var device = getDevice(device_data.id);
			if (device) {
				if (onoff) device.zone.turnOn();
				else device.zone.turnOff();

				// Give realtime update about current state
				module.exports.realtime(device_data, 'onoff', onoff);

				callback(null, onoff);
			}
			else {
				callback(true, null);
			}
		}
	},

	dim: {
		get: function (device_data, callback) {
			if (device_data instanceof Error) return callback(device_data);

			var device = getDevice(device_data.id);
			if (device) {
				callback(null, device.zone.brightness);
			}
			else {
				callback(true, null);
			}
		},

		set: function (device_data, brightness, callback) {
			if (device_data instanceof Error) return callback(device_data);

			var device = getDevice(device_data.id);
			if (device) {
				device.zone.setBrightness(brightness);

				// Give realtime update about current state
				module.exports.realtime(device_data, 'dim', brightness);

				callback(null, brightness);
			}
			else {
				callback(true, null);
			}
		}
	},

	light_temperature: {
		get: function (device_data, callback) {
			if (device_data instanceof Error) return callback(device_data);

			var device = getDevice(device_data.id);
			if (device) {
				callback(null, (device.zone.temperature == 0.5) ? 0.5 : 0);
			}
			else {
				callback(true, null);
			}
		},

		set: function (device_data, temperature, callback) {
			if (device_data instanceof Error) return callback(device_data);

			var device = getDevice(device_data.id);
			if (device) {
				device.zone.enableWhiteMode();

				// Update temp to 0.5 to indicate white mode
				module.exports.realtime(device_data, 'light_temperature', 0.5);

				callback(null, temperature);
			}
			else {
				callback(true, null);
			}
		}
	}
};

/**
 * Make sure when user removes a device, this
 * is properly handled internally
 * @param device_data
 */
module.exports.deleted = function (device_data) {

	// Loop all devices
	for (var x in devices) {

		// If device found
		if (devices[x].id == device_data.id) {

			// Remove it from devices array
			var index = devices.indexOf(devices[x]);
			if (index > -1) {
				devices.splice(index, 1);
			}
		}
	}
};

/**
 * Get device from internal device array
 * @param device_data
 * @returns {*}
 */
function getDevice(id) {
	for (var x = 0; x < devices.length; x++) {
		if (devices[x].data.id === id) {
			return devices[x];
		}
	}
}
