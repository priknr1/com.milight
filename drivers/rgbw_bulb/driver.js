"use strict";

/**
 * Import MilightController and the commands
 */
var commands = require('node-milight-promise').commands;

var foundDevices = [];
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

		// Add already installed devices to the list
		devices.push(device_data);

		// Mark by default as offline on reboot
		module.exports.setUnavailable(device_data, "Offline");
	});

	// Listen for incoming found bridges
	Homey.app.bridgeDiscovery.on('bridgeFound', function () {

		// Loop over all devices
		devices_data.forEach(function (device_data) {

			// Try to connect to device if matching bridge was found
			Homey.app.connectToDevice(devices, device_data, function (err, device_data) {

				// Mark the device as available
				if (!err && device_data) module.exports.setAvailable(device_data);
			});
		});
	});

	// Event when bridge came online
	Homey.app.bridgeDiscovery.on("bridgeOnline", function (device_data) {
		var device = getDevice(device_data);
		if (device) {
			module.exports.setAvailable({id: device.id});
		}
	});

	// Event when bridge did not respond
	Homey.app.bridgeDiscovery.on("bridgeOffline", function (device_data) {

		function pingDevice(device_data) {

			// Retry ping after 5 min
			setTimeout(function () {
				Homey.app.bridgeDiscovery.ping(device_data);
			}, 1000 * 45); // after 45 sec
		}

		// Find device
		var device = getDevice(device_data);

		// Only if device is installed start pinging
		if (device) {
			pingDevice(device_data);
		}

		// Mark as unavailable
		module.exports.setUnavailable(device_data, __("no_response"));
	});

	// Start looking for a bridge
	Homey.app.bridgeDiscovery.start();

	// Succesful start of driver
	callback(null, true);
};

/**
 * Object below constructs the pairing process of the RGBW bulb
 * @param socket Connection to the front-end
 */
module.exports.pair = function (socket) {

	var timeout = null;

	// Pairing started
	socket.on("start", function () {
		foundDevices = [Homey.app.formatDevice({uuid: "dummy"}, 0, "RGBW")];
	});

	// Listing devices
	socket.on("list_devices", function (data, callback) {

		// Loop all four groups to check if device was already found
		function checkDuplicates(device) {

			// Clear the timeout, we have response
			clearTimeout(timeout);

			// Loop all 4 groups
			for (var group = 1; group < 5; group++) {

				// Format device
				var formattedDevice = Homey.app.formatDevice(device, group, "RGBW");

				// Check if the devices are already found
				Homey.app.checkAlreadyFound(formattedDevice, foundDevices, function (found) {
					if (!found) {

						// Add to found devices
						foundDevices.push(formattedDevice);
						socket.emit('list_devices', formattedDevice);
					}
				});
			}
		}

		// Listen for found bridges
		Homey.app.bridgeDiscovery.on('bridgeFound', checkDuplicates);

		// Keep track of tries
		var numberOfTries = 0;

		// Method that recursively searches for bridge if no response
		function startRecursiveDiscovery() {

			// If tried three times and no bridge found, abort
			if (numberOfTries > 3) {
				return callback(null, []);
			}

			// Add another try
			numberOfTries++;

			// Start looking for a bridge
			Homey.app.bridgeDiscovery.start();

			// Create timeout to retry if no response
			timeout = setTimeout(function () {
				startRecursiveDiscovery();
			}, 5000);
		}

		// Start discovery
		startRecursiveDiscovery();

		// Remove listener when pairing wizard is done
		socket.on("disconnect", function () {

			// Clear the timeout
			clearTimeout(timeout);

			// Remove listener
			Homey.app.bridgeDiscovery.removeListener('bridgeFound', checkDuplicates);
		});
	});

	// Add selected device
	socket.on("add_device", function (device, callback) {

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
	});
};

/**
 * Below the capabilites of the Milight RGBW bulb are constructed
 */
module.exports.capabilities = {

	onoff: {
		get: function (device_data, callback) {
			if (device_data instanceof Error) return callback(device_data);

			// Ping bridge
			Homey.app.bridgeDiscovery.ping(device_data);

			// Fetch state of device
			getState(device_data, function (err, state) {

				// Return state
				callback(err, state);
			});
		},

		set: function (device_data, onoff, callback) {
			if (device_data instanceof Error) return callback(device_data);

			// Ping bridge
			Homey.app.bridgeDiscovery.ping(device_data);

			// Set state of device
			setState(device_data, onoff, function (err) {

				// Give realtime update about current state
				module.exports.realtime(device_data, 'onoff', onoff);

				// Return state
				callback(err, onoff);
			});
		}
	},

	dim: {
		get: function (device_data, callback) {
			if (device_data instanceof Error) return callback(device_data);

			// Ping bridge
			Homey.app.bridgeDiscovery.ping(device_data);

			// Get current dim level
			getDim(device_data, function (err, dimLevel) {

				// Return dim level
				callback(err, dimLevel);
			});
		},

		set: function (device_data, dim, callback) {
			if (device_data instanceof Error) return callback(device_data);

			// Ping bridge
			Homey.app.bridgeDiscovery.ping(device_data);

			// Set dim level
			setDim(device_data, dim, function (err) {

				// Give realtime update about current state
				module.exports.realtime(device_data, 'dim', dim);

				// Return dim level
				callback(err, dim);
			});
		}
	},

	light_hue: {
		get: function (device_data, callback) {
			if (device_data instanceof Error) return callback(device_data);

			// Ping bridge
			Homey.app.bridgeDiscovery.ping(device_data);

			// Get current hue
			getHue(device_data, function (err, color) {

				// Return hue
				callback(err, color);
			});
		},

		set: function (device_data, hue, callback) {
			if (device_data instanceof Error) return callback(device_data);

			// Ping bridge
			Homey.app.bridgeDiscovery.ping(device_data);

			// Set hue
			setHue(device_data, hue, function (err) {

				// Give realtime update about current hue
				module.exports.realtime(device_data, 'light_hue', hue);

				// Return color
				callback(err, hue);
			});
		}
	},

	light_temperature: {
		get: function (device_data, callback) {
			if (device_data instanceof Error) return callback(device_data);

			// Ping bridge
			Homey.app.bridgeDiscovery.ping(device_data);

			// Get current temperature
			getLightTemperature(device_data, function (err, temp) {

				// Return temperature
				callback(err, temp);
			});
		},

		set: function (device_data, temperature, callback) {
			if (device_data instanceof Error) return callback(device_data);

			// Ping bridge
			Homey.app.bridgeDiscovery.ping(device_data);

			// Set temperature
			setLightTemperature(device_data, temperature, function (err) {

				// Give realtime update about current temperature
				module.exports.realtime(device_data, 'temp', temperature);

				// Return temperature
				callback(err, temperature);
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
		else {
			callback(true, false);
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

	// Check if devices present
	if (devices.length > 0) {

		// Loop over all devices
		devices.forEach(function (device) {

			// Matching group found
			if (active_device.group == device.group) {

				// Check if bridge is available
				if (device.bridge) {

					// Send proper command to rgb bulb
					if (onoff == true) {
						device.bridge.sendCommands(commands.rgbw.on(device.group));
					}
					else if (onoff == false) {
						device.bridge.sendCommands(commands.rgbw.off(device.group));
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
			else {
				callback(true, false);
			}
		});
	}
	else {
		callback(true, false);
	}
}

/**
 * Fetches the dim level of a group
 * @param active_device
 * @param callback
 */
function getDim(active_device, callback) {

	// Check if devices present
	if (devices.length > 0) {

		// Loop over all devices
		devices.forEach(function (device) {

			// Matching group found
			if (active_device.group == device.group) {

				// Return dim level
				callback(null, device.dim);
			}
			else {
				callback(true, false);
			}
		});

	}
	else {
		callback(true, false);
	}
}

/**
 * Set the dim level of a group
 * @param active_device
 * @param dim
 * @param callback
 */
function setDim(active_device, dim, callback) {

	// Check if devices present
	if (devices.length > 0) {

		// Loop over all devices
		devices.forEach(function (device) {

			// Matching group found
			if (active_device.group == device.group) {

				if (dim < 0.01) {

					// Send off command
					device.bridge.sendCommands(commands.rgbw.off(device.group));

				}
				else {

					// Send on and brightness commands
					device.bridge.sendCommands(commands.rgbw.on(device.group), commands.rgbw.brightness(dim * 100));

					// Save the new dim level
					device.dim = dim;

					// Return dim level
					callback(null, device.dim);
				}
			}
			else {
				callback(true, false);
			}
		});
	}
	else {
		callback(true, false);
	}
}

/**
 * Fetches the hue level of a group
 * @param active_device
 * @param callback
 */
function getHue(active_device, callback) {

	// Check if devices present
	if (devices.length > 0) {

		// Loop over all devices
		devices.forEach(function (device) {

			// Matching group found
			if (active_device.group == device.group) {

				// Return current hue
				callback(null, device.color);
			}
			else {
				callback(true, false);
			}
		});
	}
	else {
		callback(true, false);
	}
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

	// Check if devices present
	if (devices.length > 0) {

		// Loop over all devices
		devices.forEach(function (device) {

			// Matching group found
			if (active_device.group == device.group) {

				// Turn device on, and set hue
				device.bridge.sendCommands(commands.rgbw.on(device.group), commands.rgbw.hue(milight_color));

				// Update hue
				device.color = color;

				// Return hue
				callback(null, device.color);
			}
			else {
				callback(true, false);
			}
		});
	}
	else {
		callback(true, false);
	}
}

/**
 * Get the current temperature level of a group
 * @param active_device
 * @param callback
 */
function getLightTemperature(active_device, callback) {
	// Check if devices present
	if (devices.length > 0) {

		// Loop over all devices
		devices.forEach(function (device) {

			// Matching group found
			if (active_device.group == device.group) {

				// Return temperature
				callback(null, device.temperature);
			}
			else {
				callback(true, false);
			}
		});
	}
	else {
		callback(true, false);
	}
}

/**
 * Set the group temperature of a group
 * @param active_device
 * @param temperature
 * @param callback
 */
function setLightTemperature(active_device, temperature, callback) {

	// Check if devices present
	if (devices.length > 0) {

		// Loop over all devices
		devices.forEach(function (device) {

			// Matching group found
			if (active_device.group == device.group) {

				// Send commands to group
				device.bridge.sendCommands(commands.rgbw.on(device.group), commands.rgbw.whiteMode(device.group), commands.rgbw.brightness(temperature * 100));

				// Store updated temperature
				device.temperature = temperature;

				// Return temperature
				callback(null, device.temperature);
			}
			else {
				callback(true, false);
			}
		});
	}
	else {
		callback(true, false);
	}
}

/**
 * Get device from internal device array
 * @param device_data
 * @returns {*}
 */
function getDevice(device_data) {
	for (var x = 0; x < devices.length; x++) {
		if (devices[x].uuid == device_data.id || devices[x].uuid == device_data.uuid) {
			return devices[x];
		}
	}
}