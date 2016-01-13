//To Do: Implement that light.pause is adjustable by the user
//		 Remove all-groups

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
		Homey.log("The driver of MiLight White bulb started");

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
		light_temperature: {
			get: function( device, callback ){
				getTemperature(device, function(err, temperature) {
					Homey.log('Get temp:', temperature);
					module.exports.realtime( device, 'temp', temperature );
					callback( null, temperature ) //New state
				});
			},

			set: function( device, temp, callback ){
				console.log("arguments", arguments);
				console.log("device set", device);
				setTemperature(device, temp, function(err, temperature) {
					Homey.log('Set temp:', temperature);
					module.exports.realtime( device, 'temp', temperature );
					callback( null, temperature ) //New state
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
                    name: "All white groups",
                    data: {
                        id: "all-white-groups",
                        group: "all-white",
                        state: true,
                        dim: 1,
                        white: 1,
                        temp: 1
                    }
                },
                {
                    name: "white group 1",
                    data: {
                        id: "white-group-1",
                        group: "1",
                        state: true,
                        dim: 1,
                        white: 1,
                        temp: 1
                    }
                },
                {
                    name: "white group 2",
                    data: {
                        id: "white-group-2",
                        group: "2",
                        state: true,
                        dim: 1,
                        white: 1,
                        temp: 1
                    }
                },
                {
                    name: "white group 3",
                    data: {
                        id: "white-group-3",
                        group: "3",
                        state: true,
                        dim: 1,
                        white: 1,
                        temp: 1
                    }
                },
                {
                    name: "white group 4",
                    data: {
                        id: "white-group-4",
                        group: "4",
                        state: true,
                        dim: 1,
                        white: 1,
                        temp: 1
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
	devices.forEach(function(device){ //Loopt trough all registered devices

		if (active_device.group == device.group) {

			if (device.group == "all-white") { // use group '0' for all
				if (onoff == true) light.sendCommands(commands.white.on(0));
				if (onoff == false) light.sendCommands(commands.white.off(0));

				devices.forEach(function(device){
					device.state = onoff; //Set the new state for all the devices
				});

			} else if (device.group == 1 || 2 || 3 || 4) {
				if (onoff == true) light.sendCommands(commands.white.on(device.group));
				if (onoff == false) light.sendCommands(commands.white.off(device.group));
				
				devices.forEach(function(device){
					if (device.group == "all-white") {
						device.state = onoff; //Set the new state for the all-white device
					}
				});

			}

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
	devices.forEach(function(device){ //Loopt trough all registered devices

		console.log("SetDim device", device);

		if (active_device.group == device.group) {

			if (device.group == "all-white") { // use group '0' for all
				if (dim < 0.1) { //Totally off
					light.sendCommands(commands.white.off(0));

				} else if (dim > 0.9) { //Totally on
					light.sendCommands(commands.white.maxBright(0));

				} else {
					var dim_dif = Math.round((dim - device.dim) * 10);
					console.log("dim_dif", dim_dif, "last_dim", device.dim, "dim", dim);

					if (dim_dif > 0 ) { //Brighness up
						for (var x = 0; x < dim_dif; x++) {
							console.log("Brightness up");
						    light.sendCommands(commands.white.on(0), commands.white.brightUp());;
						    light.pause(1000);
						}
					} else if (dim_dif < 0) { //Brighness down
						for (var x = 0; x < -dim_dif; x++) {
							console.log("Brightness down");
							light.sendCommands(commands.white.on(0), commands.white.brightDown())
						    light.pause(1000);
						}
					}
				}

				devices.forEach(function(device){
					device.dim = dim; //Set the new dim for all the devices
				});

			} else if (device.group == 1 || 2 || 3 || 4) {
				
				if (dim < 0.1) { //Totally off
					light.sendCommands(commands.white.off(device.group));

				} else if (dim > 0.9) { //Totally on
					light.sendCommands(commands.white.maxBright(device.group));
					
				} else {
					var dim_dif = Math.round((dim - device.dim) * 10);
					console.log("dim_dif", dim_dif, "last_dim", device.dim, "dim", dim);

					if (dim_dif > 0 ) { //Brighness up
						for (var x = 0; x < dim_dif; x++) {
							console.log("Brightness up");
						    light.sendCommands(commands.white.on(device.group), commands.white.brightUp());;
						    light.pause(1000);
						}
					} else if (dim_dif < 0) { //Brighness down
						for (var x = 0; x < -dim_dif; x++) {
							console.log("Brightness down");
							light.sendCommands(commands.white.on(device.group), commands.white.brightDown())
						    light.pause(1000);
						}
					}
				}
			}

			device.dim = dim; //Set the new dim
			console.log("setState callback", device.dim);
			callback( null, device.dim ); //Calback the new dim
		}
	});
}

// Get the Temperature of a group
function getTemperature( active_device, callback ) {
	devices.forEach(function(device){ //Loopt trough all registered devices

		console.log("GetTemperature device", device);

		if (active_device.group == device.group) {
			console.log("getTemperature callback", device.temp);
			callback( null, device.temp );
		}
	});
}

// Set the Temperature of a group
function setTemperature( active_device, temp, callback ) {
	devices.forEach(function(device){ //Loopt trough all registered devices

		console.log("SetTemperature device", device);

		if (active_device.group == device.group) {

			if (device.group == "all-white") { // use group '0' for all
				
				var temp_dif = Math.round((temp - device.temp) * 10);
				console.log("temp_dif", temp_dif, "last_temp", device.temp, "temp", temp);

				if (temp_dif > 0 ) { //Wamer up
					for (var x = 0; x < temp_dif; x++) {
						console.log("Warmer");
					    light.sendCommands(commands.white.on(0), commands.white.warmer());;
					    light.pause(1000);
					}
				} else if (temp_dif < 0) { //Cooler down
					for (var x = 0; x < -temp_dif; x++) {
						console.log("Cooler");
						light.sendCommands(commands.white.on(0), commands.white.cooler())
					    light.pause(1000);
					}
				}

				devices.forEach(function(device){
					device.temp = temp; //Set the new temp for all the devices
				});

			} else if (device.group == 1 || 2 || 3 || 4) {
				
				var temp_dif = Math.round((temp - device.temp) * 10);
				console.log("temp_dif", temp_dif, "last_temp", device.temp, "temp", temp);

				if (temp_dif > 0 ) { //Wamer up
					for (var x = 0; x < temp_dif; x++) {
						console.log("Warmer");
					    light.sendCommands(commands.white.on(device.group), commands.white.warmer());;
					    light.pause(1000);
					}
				} else if (temp_dif < 0) { //Cooler down
					for (var x = 0; x < -temp_dif; x++) {
						console.log("Cooler");
						light.sendCommands(commands.white.on(device.group), commands.white.cooler())
					    light.pause(1000);
					}
				}
			}

			device.temp = temp; //Set the new temp
			console.log("setState callback", device.temp);
			callback( null, device.temp ); //Calback the new temp
		}
	});
}

module.exports = self;