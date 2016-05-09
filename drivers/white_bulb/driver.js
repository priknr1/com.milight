"use strict";

var foundDevices = [];
var devices = [];

/**
 * On init of the driver start listening for bridges that
 * were found and try to connect installed devices
 * @param devices_homey
 * @param callback
 */
module.exports.init = function (devices_data, callback) { // we're ready

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
 * Object below constructs the pairing process of the White bulb
 * @param socket Connection to the front-end
 */
module.exports.pair = function (socket) {

	var timeout = null;

	// Pairing started
	socket.on("start", function () {
		foundDevices = [Homey.app.formatDevice({uuid: "dummy"}, 0, "White")];
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
				var formattedDevice = Homey.app.formatDevice(device, group, "White");

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
 * Below the capabilites of the Milight White bulb are constructed
 */
module.exports.capabilities = {

	onoff: {
		get: function (device_data, callback) {
			if (device_data instanceof Error) return callback(device_data);

			// Ping bridge
			Homey.app.bridgeDiscovery.ping(device_data);

			// Fetch state of device
			Homey.app.getState(devices, device_data, function (err, state) {

				// Return state
				callback(err, state);
			});
		},

		set: function (device_data, onoff, callback) {
			if (device_data instanceof Error) return callback(device_data);

			// Ping bridge
			Homey.app.bridgeDiscovery.ping(device_data);

			// Set state of device
			Homey.app.setState(devices, device_data, onoff, function (err) {

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
			Homey.app.getDim(devices, device_data, function (err, dimLevel) {

				// Return dim level
				callback(err, dimLevel);
			});
		},

		set: function (device_data, dim, callback) {
			if (device_data instanceof Error) return callback(device_data);

			// Ping bridge
			Homey.app.bridgeDiscovery.ping(device_data);

			// Set dim level
			Homey.app.setDim(devices, device_data, dim, function (err) {

				// Give realtime update about current state
				module.exports.realtime(device_data, 'dim', dim);

				// Return dim level
				callback(err, dim);
			});
		}
	},

	light_temperature: {
		get: function (device_data, callback) {
			if (device_data instanceof Error) return callback(device_data);

			// Ping bridge
			Homey.app.bridgeDiscovery.ping(device_data);

			// Get current temperature
			Homey.app.getLightTemperature(devices, device_data, function (err, temp) {

				// Return temperature
				callback(err, temp);
			});
		},

		set: function (device_data, temperature, callback) {
			if (device_data instanceof Error) return callback(device_data);

			// Ping bridge
			Homey.app.bridgeDiscovery.ping(device_data);

			// Set temperature
			Homey.app.setLightTemperature(devices, device_data, temperature, function (err) {

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