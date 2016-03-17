"use strict";

var commands = require('node-milight-promise').commands;

var util = require('util');

var newFoundDevices = [];
var devices = [];
var pauseSpeed = 500;

var self = {

	init: function (devices_homey, callback) { // we're ready
		Homey.log("The driver of MiLight White bulb started");

		//Loop trough all registered devices
		devices_homey.forEach(function (device_data) {

			devices.push(device_data) // Push every device to the local devices list
			module.exports.setUnavailable( device_data, "Offline" );

		});

		//When a new bridge is found
		Homey.app.bridgeDiscovery.on('bridgeFound', function (device) {
			console.log("New bridge found:", device);

			devices_homey.forEach(function (device_data) {

				Homey.app.connectToDevice(devices, device_data, function(err, device_data) {

					// Mark the device as available
					if(!err && device_data) module.exports.setAvailable(device_data);
				});

			});

		})

		callback();
	},

	capabilities: {
		onoff: {
			get: function (device, callback) {
				Homey.log('Get state1:', device);
				getState(device, function (err, state) {
					Homey.log('Get state2:', err, state);
					module.exports.realtime(device, 'onoff', state);
					callback(null, state) //New state
				});
			},

			set: function (device, onoff, callback) {
				console.log("device set", device);
				setState(device, onoff, function (err, state) {
					Homey.log('Set state:', state);
					module.exports.realtime(device, 'onoff', state);
					callback(null, state) //New state
				});
			}
		},
		dim: {
			get: function (device, callback) {
				getDim(device, function (err, dimLevel) {
					Homey.log('Get dim:', dimLevel);
					module.exports.realtime(device, 'dim', dimLevel);
					callback(null, dimLevel) //New state
				});
			},

			set: function (device, dim, callback) {
				console.log("arguments", arguments);
				console.log("device set", device);
				setDim(device, dim, function (err, dimLevel) {
					Homey.log('Set dim:', dimLevel);
					module.exports.realtime(device, 'dim', dimLevel);
					callback(null, dimLevel) //New state
				});
			}
		},
		light_temperature: {
			get: function (device, callback) {
				getTemperature(device, function (err, temperature) {
					Homey.log('Get temp:', temperature);
					module.exports.realtime(device, 'temp', temperature);
					callback(null, temperature) //New state
				});
			},

			set: function (device, temp, callback) {
				console.log("arguments", arguments);
				console.log("device set", device);
				setTemperature(device, temp, function (err, temperature) {
					Homey.log('Set temp:', temperature);
					module.exports.realtime(device, 'temp', temperature);
					callback(null, temperature) //New state
				});
			}
		}
	},

	pair: function (socket) {
		socket.on("start", function (data, callback) {
			Homey.log('MiLight pairing has started');
			newFoundDevices = [Homey.app.formatDevice({uuid: "dummy"}, 0, "White")]; //Enter dummy data to empty

		}),

			socket.on("list_devices", function (data, callback) {
				Homey.log("list_devices: ", data);

				function listener(device) {
					for (var group = 1; group < 5; group++) { //Walk to all 4 groups
						var formatedDevice = Homey.app.formatDevice(device, group, "White");

						// Check if the devices are already found
						Homey.app.checkAlreadyFound(formatedDevice, newFoundDevices, function (found) {
							if (!found) {
								newFoundDevices.push(formatedDevice);
								socket.emit('list_devices', formatedDevice)
							}
						})
					}
				}

				Homey.app.bridgeDiscovery.on('bridgeFound', listener);

				setTimeout(function () {
					Homey.app.bridgeDiscovery.removeListener('bridgeFound', listener); //Stop listening to the events
				}, 600000) //10 min
			}),

			socket.on("add_device", function (device, callback) {
				Homey.log("Add device: ", device);

				var deviceObj = false;
				devices.forEach(function (device_) {
					if (device_.uuid == device.data.id) deviceObj = device_;
				})

				// Add device to internal list
				devices.push(device.data);

				module.exports.setUnavailable( device.data, "Offline" );

				// Conntect to the new Device
				Homey.app.connectToDevice(devices, device.data, function (err, device_data) {

					// Mark the device as available
					if(!err && device_data) module.exports.setAvailable(device_data);
				});

				newFoundDevices = [];

				callback(null, true);
			})
	},

	deleted: function (device_data) {
		console.log("Device is removed: ", device_data);

		for (var device_id in devices) {
			if (device_id == device_data.id) {
				delete devices[device_id]; // Remove item from local device list
			}
		}
	}

}

// Get the State of a group
function getState(active_device, callback) {
	devices.forEach(function (device) { //Loopt trough all registered devices

		if (active_device.group == device.group) {
			callback(null, device.state);
		}
	});
}

// Set the State of a group
function setState(active_device, onoff, callback) {
	console.log("setState: ", onoff);
	devices.forEach(function (device) { //Loop trough all registered devices

		if (active_device.group == device.group) {
			if (onoff == true) device.bridge.sendCommands(commands.white.on(device.group));
			if (onoff == false) device.bridge.sendCommands(commands.white.off(device.group));

			device.state = onoff; //Set the new state
			callback(null, device.state); //Callback the new state

		}
	});
}

// Get the Dim of a group
function getDim(active_device, callback) {
	devices.forEach(function (device) { //Loop trough all registered devices

		console.log("GetDim");

		if (active_device.group == device.group) {
			console.log("getDim callback", device.dim);
			callback(null, device.dim);
		}
	});
}

// Set the Dim of a group
function setDim(active_device, dim, callback) {
	console.log("pauseSpeed: ", pauseSpeed);
	console.log("setDim: ", dim);
	devices.forEach(function (device) { //Loop trough all registered devices

		//console.log("SetDim device", device);

		if (active_device.group == device.group) {

			if (dim < 0.1) { //Totally off
				device.bridge.sendCommands(commands.white.off(device.group));

			}
			else if (dim > 0.9) { //Totally on
				device.bridge.sendCommands(commands.white.maxBright(device.group));

			}
			else {
				var dim_dif = Math.round((dim - device.dim) * 10);
				console.log("dim_dif", dim_dif, "last_dim", device.dim, "dim", dim);

				if (dim_dif > 0) { //Brighness up
					for (var x = 0; x < dim_dif; x++) {
						console.log("Brightness up");
						device.bridge.sendCommands(commands.white.on(device.group), commands.white.brightUp());
						;
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

// Get the Temperature of a group
function getTemperature(active_device, callback) {
	devices.forEach(function (device) { //Loop trough all registered devices

		console.log("GetTemperature");

		if (active_device.group == device.group) {
			console.log("getTemperature callback", device.temp);
			callback(null, device.temp);
		}
	});
}

// Set the Temperature of a group
function setTemperature(active_device, temp, callback) {
	console.log("setTemperature: ", temp);
	devices.forEach(function (device) { //Loopt trough all registered devices

		var temp_dif = Math.round((temp - device.temp) * 10);
		console.log("temp_dif", temp_dif, "last_temp", device.temp, "temp", temp);

		if (temp_dif > 0) { //Wamer up
			for (var x = 0; x < temp_dif; x++) {
				console.log("Warmer");
				device.bridge.sendCommands(commands.white.on(device.group), commands.white.warmer());
				;
				device.bridge.pause(pauseSpeed);
			}
		}
		else if (temp_dif < 0) { //Cooler down
			for (var x = 0; x < -temp_dif; x++) {
				console.log("Cooler");
				device.bridge.sendCommands(commands.white.on(device.group), commands.white.cooler())
				device.bridge.pause(pauseSpeed);
			}
		}

		device.temp = temp; //Set the new temp
		console.log("setState callback", device.temp);
		callback(null, device.temp); //Callback the new temp

	});
}

module.exports = self;