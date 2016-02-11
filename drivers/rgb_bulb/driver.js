"use strict";

var Milight      	= require('node-milight-promise').MilightController;
var commands     	= require('node-milight-promise').commands;

var util		 	= require('util');

var newFoundDevices = [];
var devices     	= [];
var pauseSpeed 		= 500;
		
var self = {
	
	init: function( devices_homey, callback ){
		Homey.log("The driver of MiLight RGB bulb started");

		//Loop trough all registered devices
		devices_homey.forEach(function(device_data){ 

			devices.push(device_data) // Push every device to the local devices list
			module.exports.setUnavailable( device_data, "Offline" );

		});
		
		//When a new bridge is found
		Homey.app.foundEmitter.on('newBridgeFound', function(device){
			console.log("New bridge found:", device);
		
			devices_homey.forEach(function(device_data){
			
				connectToDevice( device, device_data, function(){} ); //Connect to Device is bridge is matching
				
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
		}
	},
	
	pair: function( socket ) {
		socket.on( "start", function( data, callback ){
			Homey.log('MiLight pairing has started');
			newFoundDevices = [formatDevice( {uuid: "dummy"}, 0 )]; //Enter dummy data to empty

		}),
		
		socket.on( "list_devices", function( data, callback ){
			Homey.log("list_devices: ", data);

			function listener(device){
				for (var group = 1; group < 5; group++) { //Walk to all 4 groups
					var formatedDevice = formatDevice(device, group);
					var alreadyFound = false;

					newFoundDevices.forEach(function(device_) {
						if (formatedDevice[0].data.id == device_[0].data.id) { //Check if the found device is the same as one of the existing ones
						  	alreadyFound = true;
						  	Homey.app.foundEmitter.removeListener('bridgeFound', listener); //Stop listening to the events
						}
				  	})

				  	if (alreadyFound == false) {
				  		socket.emit('list_devices', formatedDevice);
				  		newFoundDevices.push(formatedDevice);
				  	}
				}
			}

			Homey.app.foundEmitter.on('bridgeFound', listener);
		}),

		socket.on( "add_device", function( device, callback ){
			Homey.log("Add device: ", device);

			var deviceObj = false;
			devices.forEach(function(device_){
				if( device_.uuid == device.data.id ) deviceObj = device_;
			})
			
			module.exports.setUnavailable( device.data, "Offline" );
			
			// Conntect to the new Device
			connectToDevice( deviceObj, device.data, function( err, result ){
				if( err ) return Homey.error(err);
			});

			newFoundDevices = [];

			callback( null, true );
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
	console.log("setState: ", onoff);
	devices.forEach(function(device){ //Loop trough all registered devices

		if (active_device.group == device.group) {
			if (onoff == true) device.bridge.sendCommands(commands.white.on(device.group));
			if (onoff == false) device.bridge.sendCommands(commands.white.off(device.group));

			device.state = onoff; //Set the new state
			callback( null, device.state ); //Callback the new state

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
	console.log("pauseSpeed: ", pauseSpeed);
	console.log("setDim: ", dim);
	devices.forEach(function(device){ //Loop trough all registered devices

		//console.log("SetDim device", device);

		if (active_device.group == device.group) {

			if (dim < 0.1) { //Totally off
				device.bridge.sendCommands(commands.white.off(device.group));

			} else if (dim > 0.9) { //Totally on
				device.bridge.sendCommands(commands.white.maxBright(device.group));
				
			} else {
				var dim_dif = Math.round((dim - device.dim) * 10);
				console.log("dim_dif", dim_dif, "last_dim", device.dim, "dim", dim);

				if (dim_dif > 0 ) { //Brighness up
					for (var x = 0; x < dim_dif; x++) {
						console.log("Brightness up");
					    device.bridge.sendCommands(commands.white.on(device.group), commands.white.brightUp());;
					    device.bridge.pause(pauseSpeed);
					}
				} else if (dim_dif < 0) { //Brighness down
					for (var x = 0; x < -dim_dif; x++) {
						console.log("Brightness down");
						device.bridge.sendCommands(commands.white.on(device.group), commands.white.brightDown())
					    device.bridge.pause(pauseSpeed);
					}
				}
			}

			device.dim = dim; //Set the new dim
			console.log("setState callback", device.dim);
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
	var milight_color = convertToMilightColor(color);

	devices.forEach(function(device){ //Loop trough all registered devices

		if (active_device.group == device.group) {

			device.bridge.sendCommands(commands.rgb.on(device.group), commands.rgb.hue( milight_color));

			device.color = color; //Set the new color
			callback( null, device.color ); //Callback the new color
		}
	});
}

/**
 * convertToMilightColor
 * INPUT: hue_color beteen 0 - 1
 * OUTPUT: milight_color between 0 - 255
 */
function convertToMilightColor ( hue_color )  {
	var milight_color = (256 + 176 - Math.floor(Number(hue_color) * 255.0)) % 256;
	return milight_color;
}

// Connect to the device by matching IP and making and give it a bridge object
function connectToDevice( device, device_data, callback ) {
	console.log("Connect to device");

	callback = callback || function(){}
				
	devices.forEach(function(device_){

		// map uuid to IP
		if( device_.uuid == device_data.uuid ) {
			var ip = device_data.ip; // The correct IP
			device_.bridge = "";

			device_.ip = ip; // Set the new IP in the local devices list
			module.exports.setAvailable( device_data ); // Mark the device as available

			// Create new Milight obj
			var bridge = new Milight({
			    host: ip,
			    delayBetweenCommands: 50,
			    broadcast: true
			});

			device_.bridge = bridge; //Set the new bridge obj for the device

			callback ( null, ip); //return ip
		}

	})
	
}

// Used during pairing to format the device in such a way that is possible to use 'list devices'
function formatDevice( device, group ) {
	var array = [{
		name: 'RGB Group ' + group +': Bridge (' + device.uuid + ')',
		data: {
			id: "RGB-" + device.uuid + "-" + group,
			uuid: device.uuid,
			ip: device.address,
			group: group,
            state: true,
            dim: 1,
            color: 1
        }
	}];

	return array;
}

module.exports = self;