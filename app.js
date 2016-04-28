"use strict";

/**
 * Import the milight controller
 */
var Milight = require('node-milight-promise').MilightController;

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
module.exports.convertToMilightColor = function (hue) {
	return (256 + 176 - Math.floor(Number(hue) * 255.0)) % 256;
};

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