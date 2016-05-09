"use strict";

/**
 * Import the milight controller
 */
var Milight = require('node-milight-promise').MilightController;
var commands = require('node-milight-promise').commands;
var pauseSpeed = 500;

/**
 * Keep track of bridges found
 * @type {Array}
 */
var foundDevices = [];
var EventEmitter = require('events').EventEmitter;

/**
 * Create bridgeDiscovery emitter and export it
 * to let the drivers know when a bridge is found
 */
var bridgeDiscovery = new EventEmitter();
var localAddress = null;
var message = new Buffer('Link_Wi-Fi');
var server = require('dgram').createSocket("udp4");

/**
 * Sends a broadcast message to the bridge when
 * a local address is found
 */
bridgeDiscovery.start = function () {

	// If local address already present
	if (localAddress) {

		// Send broadcast
		server.send(message, 0, message.length, 48899, localAddress);
	}
	else {

		// Wait for localAddress to be found
		bridgeDiscovery.on("gotLocalAddress", function () {
			server.send(message, 0, message.length, 48899, localAddress);
		});
	}
};

/**
 * Sends a message to a specific bridge to see
 * if it is still alive
 * @param device_data
 */
bridgeDiscovery.ping = function (device_data) {

	// Create socket and message
	var client = require('dgram').createSocket("udp4");
	var message = new Buffer('Link_Wi-Fi');

	// Response listener
	client.on('message', function (message, device) {

		// Got response stop recursive discovery
		clearTimeout(timeout);

		// Emit device found
		bridgeDiscovery.emit("bridgeOnline", {id: message.toString("utf-8").split(",")[1]});
	});

	// Create timeout
	var timeout = null;

	// Send message to client
	client.send(message, 0, message.length, 48899, device_data.ip);

	// Keep track of tries
	var numberOfTries = 0;

	// Method that recursively searches for bridge if no response
	function startRecursiveDiscovery() {

		// If tried two times and no bridge found, abort
		if (numberOfTries > 2) {
			return bridgeDiscovery.emit("bridgeOffline", device_data);
		}

		// Add another try
		numberOfTries++;

		// Start looking for a bridge
		client.send(message, 0, message.length, 48899, device_data.ip);

		// Create timeout to retry if no response
		timeout = setTimeout(function () {
			startRecursiveDiscovery();
		}, 5000);
	}

	// Start discovery
	startRecursiveDiscovery();
};

/**
 * Start searching for bridges the moment the
 * app is started
 */
module.exports.init = function () {

	// Bind the socket
	server.bind(function () {

		// Enable broadcasting
		server.setBroadcast(true);

		// Enable multiple router hops
		server.setMulticastTTL(254);

		// Fetch the local address to enable searching locally
		Homey.manager('cloud').getLocalAddress(function (err, address) {
			if (!err && address) {

				// Parse address to replace last digits with broadcast (255)
				localAddress = address.split(":")[0].split(".")[0] + "." +
					address.split(":")[0].split(".")[1] + "." +
					address.split(":")[0].split(".")[2] + ".255";

				// Address is found, continue to broadcast
				bridgeDiscovery.emit("gotLocalAddress");
			}
		});
	});

	// Reset found devices every 24 hours
	setInterval(function () {
		foundDevices = [];
	}, 86400000);

	// Listen incoming messages
	server.on('message', function (message, remote) {

		// Parse uuid from message
		var uuid = message.toString("utf-8").split(",")[1];

		// Construct device object
		var device = {
			address: remote.address,
			uuid: uuid
		};

		// A bridge was found
		bridgeDiscovery.emit('bridgeFound', device);

		// Check if bridge was not found already
		if (!foundDevices.indexOf(remote.address) > -1) {
			foundDevices.push(remote.address);
		}
	});
};

/**
 * Export bridgeDiscovery emitter to be used in the drivers
 * @type {*|EventEmitter}
 */
module.exports.bridgeDiscovery = bridgeDiscovery;

/**
 * Convert input color to color milight
 * can use
 * @param hue_color 0 - 1
 * @returns {number} 1 - 255
 */
function convertToMilightColor(hue) {
	return (256 + 176 - Math.floor(Number(hue) * 255.0)) % 256;
}

/**
 * Try to connect to a bridge
 * @param device
 * @param device_data
 * @param callback
 */
module.exports.connectToDevice = function (devices, device_data, callback) {

	// Check if devices are present
	if (devices.length > 0) {

		// Loop over all devices
		devices.forEach(function (device_) {

			// Check matching device
			if (device_.uuid == device_data.uuid) {

				// Get ip of bridge
				var ip = device_data.ip;

				// Store new ip
				device_.ip = ip;

				var device_data_obj = {
					id: device_data.id
				};

				// Create new Milight obj
				var bridge = new Milight({
					host: ip,
					delayBetweenCommands: 50,
					broadcast: true
				});

				// Set the new bridge obj for the device
				device_.bridge = bridge;

				// Return ip
				if (callback && typeof callback == "function") callback(null, device_data_obj);
			}
			else {
				callback(true, false);
			}
		});
	}
	else {
		callback(true, false);
	}
};

/**
 * Checks if a device was already found
 * @param formatedDevice
 * @param foundDevices
 * @param callback
 */
module.exports.checkAlreadyFound = function (formattedDevice, foundDevices, callback) {
	var alreadyFound = false;
	if (foundDevices && formattedDevice) {
		foundDevices.forEach(function (device_) {
			if (formattedDevice[0].data.id == device_[0].data.id) alreadyFound = true;
		});
	}

	callback(alreadyFound);
};

/**
 * Formats incoming data to be send to the front-end
 * in the list devices view
 * @param device
 * @param group
 * @returns {*[]}
 */
module.exports.formatDevice = function (device, group, type) {
	return [{
		name: type + ' Group ' + group + ': Bridge (' + device.uuid + ')',
		data: {
			id: type + "-" + device.uuid + "-" + group,
			type: type,
			uuid: device.uuid,
			ip: device.address,
			group: group,
			state: true,
			dim: 1,
			color: 1,
			temperature: 1
		}
	}];
};

/**
 * Return the command library specific
 * to the provided bulb type
 * @param type
 * @returns {commands.type}
 */
function getCommands(type) {
	switch (type) {
		case "RGBW":
			return commands.rgbw;
			break;
		case "RGB":
			return commands.rgb;
			break;
		case "White":
			return commands.white;
			break;
	}
}

/**
 * Fetches the state of a group
 * @param active_device
 * @param callback
 */
module.exports.getState = function (devices, active_device, callback) {

	// Check if devices present
	if (devices.length > 0) {

		var success = false;

		// Loop over all devices
		devices.forEach(function (device) {

			// Matching bridge group
			if (active_device.id == device.id) {

				// Return current hue
				if (!success) callback(null, (device.state == 1));

				// Mark success
				success = true;
			}
		});

		// If failure callback
		if (!success) callback(true, false);
	}
	else {
		callback(true, false);
	}
};

/**
 * Set the onoff state of a group
 * @param active_device
 * @param onoff
 * @param callback
 */
module.exports.setState = function (devices, active_device, onoff, callback) {

	// Check if devices present
	if (devices.length > 0) {

		var success = false;

		// Loop over all devices
		devices.forEach(function (device) {

			// Matching group found
			if (active_device.group == device.group) {

				// Check if bridge is available
				if (device.bridge) {

					// Send proper command to rgb bulb
					if (onoff == true) {
						device.bridge.sendCommands(getCommands(active_device.type).on(device.group));
					}
					else if (onoff == false) {
						device.bridge.sendCommands(getCommands(active_device.type).off(device.group));
					}

					// Update state of device
					device.state = onoff;

					// Return success
					if (!success) callback(null, device.state);

					success = true;
				}
			}
		});

		// Return failure
		if (!success) callback(true, false);
	}
	else {
		callback(true, false);
	}
};

/**
 * Fetches the dim level of a group
 * @param active_device
 * @param callback
 */
module.exports.getDim = function (devices, active_device, callback) {

	// Check if devices present
	if (devices.length > 0) {

		var success = false;

		// Loop over all devices
		devices.forEach(function (device) {

			// Matching group found
			if (active_device.group == device.group) {

				// Return current hue
				if (!success) callback(null, device.dim);

				// Mark success
				success = true;
			}
		});

		// If failure callback
		if (!success) callback(true, false);
	}
	else {
		callback(true, false);
	}
};

/**
 * Set the dim level of a group
 * @param active_device
 * @param dim
 * @param callback
 */
module.exports.setDim = function (devices, active_device, dim, callback) {

	var success = false;

	// Check if devices present
	if (devices.length > 0) {

		// Loop over all devices
		devices.forEach(function (device) {

			// Matching group found
			if (active_device.group == device.group) {

				if (dim < 0.01) {

					// Send off command
					device.bridge.sendCommands(getCommands(active_device.type).off(device.group));

				}
				else if (active_device.type == "RGB") {
					var dim_dif = Math.round((dim - device.dim) * 10);

					if (dim_dif > 0) {
						for (var x = 0; x < dim_dif; x++) {
							device.bridge.sendCommands(getCommands(active_device.type).on(device.group), getCommands(active_device.type).brightUp());
							device.bridge.pause(pauseSpeed);
						}
					}
					else if (dim_dif < 0) {
						for (var x = 0; x < -dim_dif; x++) {
							device.bridge.sendCommands(getCommands(active_device.type).on(device.group), getCommands(active_device.type).brightDown());
							device.bridge.pause(pauseSpeed);
						}
					}
				}
				else if (active_device.type == "White") {
					if (dim < 0.01) {

						// Below 0.1 turn light off
						device.bridge.sendCommands(getCommands(active_device.type).off(device.group));
					}
					else if (dim > 0.95) {

						// Turn light to bax brightness
						device.bridge.sendCommands(getCommands(active_device.type).maxBright(device.group));
					}
					else {

						// Calculate dim difference
						var dim_dif = Math.round((dim - device.dim) * 10);

						if (dim_dif > 0) {
							for (var x = 0; x < dim_dif; x++) {

								// Send commands to turn up the brightness
								device.bridge.sendCommands(getCommands(active_device.type).on(device.group), getCommands(active_device.type).brightUp());
								device.bridge.pause(pauseSpeed);
							}
						}
						else if (dim_dif < 0) {
							for (var x = 0; x < -dim_dif; x++) {

								// Send commands to turn down the brightness
								device.bridge.sendCommands(getCommands(active_device.type).on(device.group), getCommands(active_device.type).brightDown());
								device.bridge.pause(pauseSpeed);
							}
						}
					}
				}
				else {

					// Send on and brightness commands
					device.bridge.sendCommands(getCommands(active_device.type).on(device.group), getCommands(active_device.type).brightness(dim * 100));
				}

				// Return dim level
				if (!success) callback(null, device.dim);

				success = true;

				// Save the new dim level
				device.dim = dim;
			}
		});

		if (!success) callback(true, false);
	}
	else {
		callback(true, false);
	}
};

/**
 * Fetches the hue level of a group
 * @param active_device
 * @param callback
 */
module.exports.getHue = function (devices, active_device, callback) {

	// Check if devices present
	if (devices.length > 0) {

		var success = false;

		// Loop over all devices
		devices.forEach(function (device) {

			// Matching group found
			if (active_device.group == device.group) {

				// Return current hue
				if (!success) callback(null, device.color);

				// Mark success
				success = true;
			}
		});

		// If failure callback
		if (!success) callback(true, false);
	}
	else {
		callback(true, false);
	}
};

/**
 * Set hue level of a group
 * @param active_device
 * @param color
 * @param callback
 */
module.exports.setHue = function (devices, active_device, color, callback) {

	var success = false;

	// Map color to value milight can use
	var milight_color = convertToMilightColor(color);

	// Check if devices present
	if (devices.length > 0) {

		// Loop over all devices
		devices.forEach(function (device) {

			// Matching group found
			if (active_device.group == device.group) {

				// Turn device on, and set hue
				device.bridge.sendCommands(getCommands(active_device.type).on(device.group), getCommands(active_device.type).hue(milight_color));

				// Update hue
				device.color = color;

				// Return hue
				if (!success) callback(null, device.color);

				success = true;
			}
		});

		if (!success) callback(true, false);
	}
	else {
		callback(true, false);
	}
};

/**
 * Get the current temperature level of a group
 * @param active_device
 * @param callback
 */
module.exports.getLightTemperature = function (devices, active_device, callback) {

	// Check if devices present
	if (devices.length > 0) {

		var success = false;

		// Loop over all devices
		devices.forEach(function (device) {

			// Matching group found
			if (active_device.group == device.group) {

				// Return current hue
				if (!success) callback(null, device.temperature);

				// Mark success
				success = true;
			}
		});

		// If failure callback
		if (!success) callback(true, false);
	}
	else {
		callback(true, false);
	}
};

/**
 * Set the group temperature of a group
 * @param active_device
 * @param temperature
 * @param callback
 */
module.exports.setLightTemperature = function (devices, active_device, temperature, callback) {

	var success = false;

	// Check if devices present
	if (devices.length > 0) {

		// Loop over all devices
		devices.forEach(function (device) {

			// Matching group found
			if (active_device.group == device.group) {

				// Check for type of bulb
				if (active_device.type == "White") {

					// Calculate temperature difference
					var temp_dif = Math.round((temperature - device.temperature) * 10);
					if (temp_dif > 0) {
						for (var x = 0; x < temp_dif; x++) {

							// Send commands to turn light warmer
							device.bridge.sendCommands(getCommands(active_device.type).on(device.group), getCommands(active_device.type).warmer());
							device.bridge.pause(pauseSpeed);
						}
					}
					else if (temp_dif < 0) { //Cooler down
						for (var x = 0; x < -temp_dif; x++) {

							// Send commands to turn light cooler
							device.bridge.sendCommands(getCommands(active_device.type).on(device.group), getCommands(active_device.type).cooler());
							device.bridge.pause(pauseSpeed);
						}
					}
				}
				else if (active_device.type == "RGBW") {

					// Send commands to group
					device.bridge.sendCommands(getCommands(active_device.type).on(device.group), getCommands(active_device.type).whiteMode(device.group));
				}
				else {

					// Send commands to group
					device.bridge.sendCommands(getCommands(active_device.type).on(device.group), getCommands(active_device.type).whiteMode(device.group), commands.rgbw.brightness(temperature * 100));
				}

				// Store updated temperature
				device.temperature = temperature;

				// Return temperature
				if (!success) callback(null, device.temperature);

				success = true;
			}
		});

		if (!success) callback(true, false);
	}
	else {
		callback(true, false);
	}
};