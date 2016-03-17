"use strict";

var Milight      	= require('node-milight-promise').MilightController;
var commands     	= require('node-milight-promise').commands;

var util		 	= require('util');

var newFoundDevices = [];
var devices      	= [];

var self = {

	init: function( devices_homey, callback ){
		Homey.log("The driver of MiLight RGBW bulb started");

		//Loop trough all registered devices
		devices_homey.forEach(function(device_data){
			devices.push(device_data) // Push every device to the local devices list
			module.exports.setUnavailable( device_data, "Offline" );

		});

		//When a new bridge is found
		Homey.app.bridgeDiscovery.on('bridgeFound', function(){

			devices_homey.forEach(function(device_data){

				Homey.app.connectToDevice( devices, device_data, function(err, device_data){

					// Mark the device as available
					if(!err && device_data) module.exports.setAvailable(device_data);

				} );

			});

		})

		callback();
	},

	capabilities: {
		onoff: {
			get: function( device, callback ){
				getState(device, function(err, state) {
					Homey.log('Get state:', state);
					module.exports.realtime( device, 'onoff', state );
					callback( null, state ) //New state
				});
			},

			set: function( device, onoff, callback ){
				console.log("device set", device);
				setState(device, onoff, function(err, state) {
					Homey.log('Set state:', state);
					module.exports.realtime( device, 'onoff', state );
					callback( null, state ) //New state
				});
			}
		},
		dim: {
			get: function( device, callback ){
				getDim(device, function(err, dimLevel) {
					Homey.log('Get dim:', dimLevel);
					module.exports.realtime( device, 'dim', dimLevel );
					callback( null, dimLevel ) //New state
				});
			},

			set: function( device, dim, callback ){
				console.log("arguments", arguments);
				console.log("device set", device);
				setDim(device, dim, function(err, dimLevel) {
					Homey.log('Set dim:', dimLevel);
					module.exports.realtime( device, 'dim', dimLevel );
					callback( null, dimLevel ) //New state
				});
			}
		},
		light_hue: {
			get: function( device, callback ){
				getColor(device, function(err, color) {
					Homey.log('Get color:', color);
					module.exports.realtime( device, 'light_hue', color );
					callback( null, color ) //New state
				});
			},

			set: function( device, hue, callback ){
				console.log("arguments", arguments);
				console.log("device set", device);
				setColor(device, hue, function(err, color) {
					Homey.log('Set color:', color);
					module.exports.realtime( device, 'light_hue', color );
					callback( null, color ) //New state
				});
			}
		},
		light_temperature: {
			get: function( device, callback ){
				getLightTemperature(device, function(err, temp) {
					Homey.log('Get light temperature:', temp);
					module.exports.realtime( device, 'temp', temp );
					callback( null, temp ) //New state
				});
			},

			set: function( device, temp, callback ){
				console.log("arguments", arguments);
				console.log("device set", device);
				setLightTemperature(device, temp, function(err, temp) {
					Homey.log('Set temp:', temp);
					module.exports.realtime( device, 'temp', temp );
					callback( null, temp ) //New state
				});
			}
		}
	},

	pair: function( socket ) {
		socket.on( "start", function( data, callback ){
			Homey.log('MiLight pairing has started');
			newFoundDevices = [Homey.app.formatDevice( {uuid: "dummy"}, 0 , "RGBW")]; //Enter dummy data to empty

		}),

		socket.on( "list_devices", function( data, callback ){
			Homey.log("list_devices: ", data);

			function listener(device){
				for (var group = 1; group < 5; group++) { //Walk to all 4 groups
					var formatedDevice = Homey.app.formatDevice(device, group, "RGBW");

					// Check if the devices are already found
				  	Homey.app.checkAlreadyFound (formatedDevice, newFoundDevices, function (found) {
				  		if (!found) {
				  			newFoundDevices.push(formatedDevice);
				  			socket.emit('list_devices', formatedDevice)
				  		}
				  	})
				}
			}

			Homey.app.bridgeDiscovery.on('bridgeFound', listener);

			setTimeout (function() {
				Homey.app.bridgeDiscovery.removeListener('bridgeFound', listener); //Stop listening to the events
			}, 600000) //10 min
		}),

		socket.on( "add_device", function( device, callback ){
			Homey.log("Add device: ", device);

			var deviceObj = false;
			devices.forEach(function(device_){
				if( device_.uuid == device.data.id ) deviceObj = device_;
			});

			// Add device to internal list
			devices.push(device.data);

			module.exports.setUnavailable( device.data, "Offline" );

			// Connect to the new Device
			Homey.app.connectToDevice( devices, device.data, function( err, device_data ){

				// Mark the device as available
				if(!err && device_data) module.exports.setAvailable(device_data);
			});

			newFoundDevices = [];

			callback( null, device.data.id );
		})
	},

	deleted: function ( device_data ) {
		console.log("Device is removed: ", device_data);

		for( var device_id in devices ) {
			if (device_id == device_data.id) {
				delete devices[device_id]; // Remove item from local device list
			}
		}
	}
}

// Get the State of a group
function getState( active_device, callback ) {
	devices.forEach(function(device){ //Loop trough all registered devices

		if (active_device.group == device.group) {
			callback( null, device.state );
		}
	});
}

// Set the State of a group
function setState( active_device, onoff, callback ) {
	console.log("setState :", onoff);
	devices.forEach(function(device){ //Loop trough all registered devices

		if (active_device.group == device.group) {

			// TO DO:
			// checkAvailability (device, function (available) {
			//	if (available) {
					if (onoff == true) device.bridge.sendCommands(commands.rgbw.on(device.group), commands.rgbw.brightness(100));
					if (onoff == false) device.bridge.sendCommands(commands.rgbw.off(device.group));

					device.state = onoff; //Set the new state
					callback( null, device.state ); //Callback the new state
			//	}
			//})
		}
	});
}

// Get the Dim of a group
function getDim( active_device, callback ) {
	devices.forEach(function(device){ //Loop trough all registered devices

		console.log("GetDim");

		if (active_device.group == device.group) {
			console.log("getDim callback", device.dim);
			callback( null, device.dim );
		}
	});
}

// Set the Dim of a group
function setDim( active_device, dim, callback ) {
	console.log("setDim: ", dim);
	devices.forEach(function(device){ //Loopt trough all registered devices

		console.log("SetDim");

		if (active_device.group == device.group) {

			device.bridge.sendCommands(commands.rgbw.on(device.group), commands.rgbw.brightness(dim*100));

			device.dim = dim; //Set the new dim
			callback( null, device.dim ); //Callback the new dim
		}
	});
}

// Get the Color of a group
function getColor( active_device, callback ) {
	devices.forEach(function(device){ //Loop trough all registered devices

		if (active_device.group == device.group) {
			console.log("getColor callback", device.color);
			callback( null, device.color );
		}
	});
}

// Set the Color of a group
function setColor( active_device, color, callback ) {
	console.log("setcolor: ", color);
	var milight_color = Homey.app.convertToMilightColor(color);

	devices.forEach(function(device){ //Loop trough all registered devices

		if (active_device.group == device.group) {

			device.bridge.sendCommands(commands.rgbw.on(device.group), commands.rgbw.hue( milight_color));

			device.color = color; //Set the new color
			callback( null, device.color ); //Callback the new color
		}
	});
}

// Get the Light Temperature of a group
function getLightTemperature( active_device, callback ) {
	devices.forEach(function(device){ //Loop trough all registered devices

		if (active_device.group == device.group) {
			console.log("getColor callback", device.temperature);
			callback( null, device.temperature );
		}
	});
}

// Set the Light Temperature of a group
function setLightTemperature( active_device, temperature, callback ) {
	console.log("settemperature: ", temperature);

	devices.forEach(function(device){ //Loop trough all registered devices

		if (active_device.group == device.group) {

			device.bridge.sendCommands(commands.rgbw.on(device.group), commands.rgbw.whiteMode(device.group), commands.rgbw.brightness(temperature*100));

			device.temperature = temperature; //Set the new temperature
			callback( null, device.temperature ); //Callback the new temperature
		}
	});
}

module.exports = self;