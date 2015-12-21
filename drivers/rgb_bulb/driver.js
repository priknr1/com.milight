//TO-DO: Fix RGB offset

"use strict";

var Milight = require("milight");
var devices = [];

var milight = new Milight({
    host: "192.168.1.255", //use .225 at the end to do a search
    broadcast: true
});

//var devices contains:
/*var devices 		= {
	"uuid:fooUuid": { //uuid
		"name": fooName,
		"ip": 255.255.255.255,
		"port": 1234,
		"state": 0
	}
}*/
		
var self = {
	
	init: function( devices_homey, callback ){ // we're ready
		Homey.log("The driver of MiLight started");

		console.log("devices_homey", devices_homey);

		devices_homey.forEach(function(device){ //Loopt trough all registered devices

				console.log("device", device)

				devices.push(device)

			});

		//devices.push(devices_homey);

		console.log("devices", devices)

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
	},
	
	pair: function( socket ) {
		socket.on( "start", function( data, callback ){
			Homey.log('MiLight pairing has started');
		}),
		
		socket.on( "list_devices", function( data, callback ){
			Homey.log("List devices");

			var devices_list 		= [
				{
                    name: "All color groups",
                    data: {
                        id: "all-color-groups",
                        group: "all-color",
                        state: true,
                        dim: 1,
                        color: 1
                    }
                },
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
	devices.forEach(function(device){ //Loopt trough all registered devices

		if (active_device.group == device.group) {

			if (device.group == "all-color") {
				if (onoff == true) milight.on();
				if (onoff == false) milight.off();

				devices.forEach(function(device){
					device.state = onoff; //Set the new state for all the devices
				});

			} else if (device.group == 1 || 2 || 3 || 4) {
				if (onoff == true) milight.zone(device.group).on();
				if (onoff == false) milight.zone(device.group).off();
				
				devices.forEach(function(device){
					if (device.group == "all-color") {
						device.state = onoff; //Set the new state for the all-color device
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

			if (device.group == "all-color") {
				milight.brightness( Math.floor( dim*100 ) , function(err) {});

				devices.forEach(function(device){
					device.dim = dim; //Set the new dim for all the devices
				});

			} else if (device.group == 1 || 2 || 3 || 4) {
				milight.zone(device.group).brightness( Math.floor( dim*100 ) , function(err) {});
				
				devices.forEach(function(device){
					if (device.group == "all-color") {
						device.dim = dim; //Set the new dim for the all-color device
					}
				});
			}

			device.dim = dim; //Set the new dim
			console.log("setState callback", device.dim);
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

	//Pre calculation because hue colors are shifted in the library! h - 120
	var hueColor = color * 360;
	console.log("SetDim color1", hueColor, color);
	if (hueColor > 140) {
		hueColor = Math.floor( hueColor - 140 );
	} else if (hueColor < 140) {
		hueColor = Math.floor( 360 - (140 - hueColor) );
	}

	devices.forEach(function(device){ //Loopt trough all registered devices

		if (active_device.group == device.group) {

			if (device.group == "all-color") {
				milight.brightness( color , function(err) {});
				milight.hsv( hueColor, -1, Math.floor( device.dim * 100 ), function(error) {}); // h(0-360), s(not used), v(0-100)
				console.log("SetDim color2", hueColor, color);

				devices.forEach(function(device){
					device.color = color; //Set the new color for all the devices
				});

			} else if (device.group == 1 || 2 || 3 || 4) {
				milight.zone(device.group).hsv( hueColor, -1, Math.floor( device.dim * 100 ), function(error) {}); // h(0-360), s(not used), v(0-100)
				console.log("SetDim color3", hueColor, color);

				devices.forEach(function(device){
					if (device.group == "all-color") {
						device.color = color; //Set the new color for the all-color device
					}
				});
			}

			device.color = color; //Set the new color
			callback( null, device.color ); //Calback the new color
		}
	});
}

module.exports = self;