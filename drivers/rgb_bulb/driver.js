"use strict";

/**
 * Import MilightController and the commands
 */
var commands = require('node-milight-promise').commands;

var foundDevices = [];
var devices = [];
var pauseSpeed = 500;

/**
 * On init of the driver start listening for bridges that
 * were found and try to connect installed devices
 * @param devices_homey
 * @param callback
 */
module.exports.init = function (devices_data, callback) {

	// Loop trough all registered devices
	devices_data.forEach(function (device_data) {

		// Add already installed devices to the list
		devices.push(device_data);

		// Mark be default as offline on reboot
		module.exports.setUnavailable(device_data, "Offline");
	});

	// Listen for incoming found bridges
	Homey.app.bridgeDiscovery.on('bridgeFound', function (bridge) {

		// Loop over all devices
		devices_data.forEach(function (device_data) {

			// Try to connect to device if matching bridge was found
			Homey.app.connectToDevice(devices, device_data, function (err, device_data) {

				// Mark the device as available
				if (!err && device_data) module.exports.setAvailable(device_data);
			});
		});
	});

	// Succesfull start of driver
	callback(null, true);
};

/**
 * Object below constructs the pairing process of the RGB bulb
 * @param socket Connection to the front-end
 */
module.exports.pair = function (socket) {

	// Pairing started
	socket.on("start", function (data, callback) {
		Homey.log('MiLight pairing has started');
		foundDevices = [Homey.app.formatDevice({uuid: "dummy"}, 0, "RGB")]; //Enter dummy data to empty
	});

	// Listing devices
	socket.on("list_devices", function (data, callback) {
		Homey.log("list_devices: ", data);

		// TODO what is it?
		function listener(device) {

			// Iterate all 4 groups
			for (var group = 1; group < 5; group++) {
				var formattedDevice = Homey.app.formatDevice(device, group, "RGB");

				// Check if the devices are already found
				Homey.app.checkAlreadyFound(formattedDevice, foundDevices, function (found) {
					if (!found) {

						// Add to found devices
						foundDevices.push(formattedDevice);
						socket.emit('list_devices', formattedDevice)
					}
				});
			}
		}

		Homey.app.bridgeDiscovery.on('bridgeFound', listener);

		setTimeout(function () {
			Homey.app.bridgeDiscovery.removeListener('bridgeFound', listener); //Stop listening to the events
		}, 600000);
	});

	// Add selected device
	socket.on("add_device", function (device, callback) {
		Homey.log("Add device: ", device);

		var deviceObj = false;
		devices.forEach(function (installed_device) {

			// If already installed
			if (installed_device.uuid == device.data.id) {
				deviceObj = installed_device;
			}
		});

		// Add device to internal list
		devices.push(device.data);

		// Mark as offline by default
		module.exports.setUnavailable(device.data, "Offline");

		// Conntect to the new Device
		Homey.app.connectToDevice(devices, device.data, function (err, device_data) {
			// Mark the device as available
			if (!err && device_data) module.exports.setAvailable(device_data);
		});

		// Empty found devices to prevent piling up
		foundDevices = [];

		// Return success
		callback(null, true);
	})
};

/**
 * Below the capabilites of the Milight RGB bulb are constructed
 */
module.exports.capabilities = {

	onoff: {
		get: function (device_data, callback) {
			if (device_data instanceof Error) return callback(device_data);

			// Fetch state of device
			getState(device_data, function (err, state) {
				Homey.log('Get state:', state);

				// Return state
				callback(null, state);
			});
		},

		set: function (device_data, onoff, callback) {
			if (device_data instanceof Error) return callback(device_data);

			// Set state of device
			setState(device_data, onoff, function (err, state) {
				Homey.log('Set state:', state);

				// Give realtime update about current state
				module.exports.realtime(device_data, 'onoff', state);

				// Return state
				callback(null, state);
			});
		}
	},

	dim: {
		get: function (device_data, callback) {
			if (device_data instanceof Error) return callback(device_data);

			// Get current dim level
			getDim(device_data, function (err, dimLevel) {
				Homey.log('Get dim:', dimLevel);

				// Return dim level
				callback(null, dimLevel);
			});
		},

		set: function (device_data, dim, callback) {
			if (device_data instanceof Error) return callback(device_data);

			// Set dim level
			setDim(device_data, dim, function (err, dimLevel) {
				Homey.log('Set dim:', dimLevel);

				// Give realtime update about current state
				module.exports.realtime(device_data, 'dim', dimLevel);

				// Return dim level
				callback(null, dimLevel);
			});
		}
	},

	light_hue: {
		get: function (device_data, callback) {
			if (device_data instanceof Error) return callback(device_data);

			// Get current hue
			getHue(device_data, function (err, color) {
				Homey.log('Get color:', color);

				// Return hue
				callback(null, color);
			});
		},

		set: function (device_data, hue, callback) {
			if (device_data instanceof Error) return callback(device_data);

			// Set hue
			setHue(device_data, hue, function (err, color) {
				Homey.log('Set color:', color);

				// Give realtime update about current hue
				module.exports.realtime(device_data, 'light_hue', color);

				// Return color
				callback(null, color);
			});
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
	for (var device_id in devices) {

		// If device found
		if (device_id == device_data.id) {

			// Remove it from devices array
			delete devices[device_id];
		}
	}
};

/**
 * Fetches the state of a group
 * @param active_device
 * @param callback
 */
function getState(active_device, callback) {

	// Loop over all devices
	devices.forEach(function (device) {

		// Matching group found
		if (active_device.group == device.group) {

			// Return group state
			callback(null, device.state);
		}
	});
}

/**
 * Set the onoff state of a group
 * @param active_device
 * @param onoff
 * @param callback
 */
function setState(active_device, onoff, callback) {

	// Loop over all devices
	devices.forEach(function (device) {

		// Matching group found
		if (active_device.group == device.group) {

			// Check if bridge is available
			if (device.bridge) {

				// Send proper command to rgb bulb
				if (onoff == true) {
					device.bridge.sendCommands(commands.rgb.on(device.group));
				}
				else if (onoff == false) {
					device.bridge.sendCommands(commands.rgb.off(device.group));
				}

				// Update state of device
				device.state = onoff;

				// Return success
				callback(null, device.state);
			}
			else {
				callback(true, false);
			}
		}
	});
}

/**
 * Fetches the dim level of a group
 * @param active_device
 * @param callback
 */
function getDim(active_device, callback) {

	// Loop over all devices
	devices.forEach(function (device) {

		// Matching group found
		if (active_device.group == device.group) {

			// Return dim level
			callback(null, device.dim);
		}
	});
}

/**
 * Set the dim level of a certain group
 * @param active_device
 * @param dim
 * @param callback
 */
function setDim(active_device, dim, callback) {

	// Loop over all devices
	devices.forEach(function (device) {

		// Matching group found
		if (active_device.group == device.group) {

			// TODO dim level white -> rgb
			if (dim < 0.1) {
				device.bridge.sendCommands(commands.white.off(device.group));
			}
			else if (dim > 0.9) {
				device.bridge.sendCommands(commands.white.maxBright(device.group));
			}
			else {
				var dim_dif = Math.round((dim - device.dim) * 10);
				console.log("dim_dif", dim_dif, "last_dim", device.dim, "dim", dim);

				if (dim_dif > 0) { //Brighness up
					for (var x = 0; x < dim_dif; x++) {
						console.log("Brightness up");
						device.bridge.sendCommands(commands.white.on(device.group), commands.white.brightUp());
						device.bridge.pause(pauseSpeed);
					}
				}
				else if (dim_dif < 0) { //Brighness down
					for (var x = 0; x < -dim_dif; x++) {
						console.log("Brightness down");
						device.bridge.sendCommands(commands.white.on(device.group), commands.white.brightDown())
						device.bridge.pause(pauseSpeed);
					}
				}
			}

			device.dim = dim; //Set the new dim
			console.log("setState callback", device.dim);
			callback(null, device.dim); //Callback the new dim
		}
	});
}

/**
 * Fetches the hue level of a group
 * @param active_device
 * @param callback
 */
function getHue(active_device, callback) {

	// Loop over all devices
	devices.forEach(function (device) {

		// Matching group found
		if (active_device.group == device.group) {

			// Return current hue
			callback(null, device.color);
		}
	});
}

/**
 * Set hue level of a group
 * @param active_device
 * @param color
 * @param callback
 */
function setHue(active_device, color, callback) {

	// Map color to value milight can use
	var milight_color = Homey.app.convertToMilightColor(color);

	// Loop over all devices
	devices.forEach(function (device) {

		// Matching group found
		if (active_device.group == device.group) {

			console.log("TOGGLE HUE: " + milight_color);
			// Turn device on, and set hue
			device.bridge.sendCommands(commands.rgb.on(device.group), commands.rgb.hue(milight_color));

			// Update hue
			device.color = color;

			// Return hue
			callback(null, device.color);
		}
	});
}