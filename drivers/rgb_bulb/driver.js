//To Do: Implement that light.pause is adjustable by the user,

"use strict";

var Milight = require('node-milight-promise').MilightController;
var commands = require('node-milight-promise').commands;
var devices = [];

var light = new Milight({
    host: "192.168.1.255", //use .225 at the end to do a search
    delayBetweenCommands: 50,
    broadcast: true
});
		
var self = {
	
	init: function( devices_homey, callback ){ // we're ready
		Homey.log("The driver of MiLight RGB bulb started");

		devices_homey.forEach(function(device){ //Loopt trough all registered devices

				devices.push(device) // Push every device to the local devices list

			});

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
		}),
		
		socket.on( "list_devices", function( data, callback ){
			Homey.log("List devices");

			var devices_list 		= [
                {
                    name: "Color group 1",
                    data: {
                        id: "color-group-1",
                        group: "1",
                        state: true,
                        dim: 1,
                        color: 1
                    }
                },
                {
                    name: "Color group 2",
                    data: {
                        id: "color-group-2",
                        group: "2",
                        state: true,
                        dim: 1,
                        color: 1
                    }
                },
                {
                    name: "Color group 3",
                    data: {
                        id: "color-group-3",
                        group: "3",
                        state: true,
                        dim: 1,
                        color: 1
                    }
                },
                {
                    name: "Color group 4",
                    data: {
                        id: "color-group-4",
                        group: "4",
                        state: true,
                        dim: 1,
                        color: 1
                    }
                }
            ];

			devices.push(devices_list);

			callback( null, devices_list );
			
			//foundDevices = {};
		})
	},
	
}

// Get the State of a group
function getState( active_device, callback ) {
	devices.forEach(function(device){ //Loopt trough all registered devices

		if (active_device.group == device.group) {
			callback( null, device.state );
		}
	});
}

// Set the State of a group
function setState( active_device, onoff, callback ) {
	console.log("setState :", onoff);
	devices.forEach(function(device){ //Loopt trough all registered devices

		if (active_device.group == device.group) {

			if (onoff == true) light.sendCommands(commands.rgbw.on(device.group), commands.rgbw.brightness(100));
			if (onoff == false) light.sendCommands(commands.rgbw.off(device.group));

			device.state = onoff; //Set the new state
			callback( null, device.state ); //Calback the new state
		}
	});
}

// Get the Dim of a group
function getDim( active_device, callback ) {
	devices.forEach(function(device){ //Loopt trough all registered devices

		console.log("GetDim device", device);

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

		console.log("SetDim device", device);

		if (active_device.group == device.group) {

			light.sendCommands(commands.rgbw.on(device.group), commands.rgbw.brightness(dim*100));
			
			device.dim = dim; //Set the new dim
			callback( null, device.dim ); //Calback the new dim	
		}
	});
}

// Get the Color of a group
function getColor( active_device, callback ) {
	devices.forEach(function(device){ //Loopt trough all registered devices

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

	devices.forEach(function(device){ //Loopt trough all registered devices

		if (active_device.group == device.group) {

			light.sendCommands(commands.rgbw.on(device.group), commands.rgbw.hue( milight_color));

			device.color = color; //Set the new color
			callback( null, device.color ); //Calback the new color
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

module.exports = self;