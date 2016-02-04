"use strict";

var Milight      = require('node-milight-promise').MilightController;
var commands     = require('node-milight-promise').commands;

var util		 = require('util');
var events		 = require('events');
var dgram 		 = require('dgram');
var Emitter      = require('events').EventEmitter;

var newFoundDevices = [];
var devices      = [];
var foundDevices = [];
var foundEmitter = new Emitter();
		
var self = {
	
	init: function( devices_homey, callback ){
		Homey.log("The driver of MiLight RGBW bulb started");

		discoverBridges();

		//Loop trough all registered devices
		devices_homey.forEach(function(device_data){ 

			devices.push(device_data) // Push every device to the local devices list
			module.exports.setUnavailable( device_data, "Offline" );

		});
		
		//When a new bridge is found
		foundEmitter.on('newBridgeFound', function(device){
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
			newFoundDevices = [];
		}),
		
		socket.on( "list_devices", function( data, callback ){
			Homey.log("List devices: ", data);

			// when a new device has been found
			foundEmitter.on('bridgeFound', function(device){
				console.log("newFoundDevices: ", newFoundDevices);
				console.log("socket1", socket);
				if (newFoundDevices.length > 0 && socket) { // If newFoundDevices contains devices and socket exists
					newFoundDevices.forEach(function(device_){
						console.log("socket2", socket);
						if( device_[0].data.uuid != device.uuid ) {
							socket.emit('list_devices', formatDevice(device));
						    newFoundDevices.push(device);
						}
					})
				} else if (socket) {
					console.log("socket3", socket);
					socket.emit('list_devices', formatDevice(device));
					newFoundDevices.push(formatDevice(device));
				}
			})
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

			if (onoff == true) device.bridge.sendCommands(commands.rgbw.on(device.group), commands.rgbw.brightness(100));
			if (onoff == false) device.bridge.sendCommands(commands.rgbw.off(device.group));

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
	var milight_color = convertToMilightColor(color);

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

/**
 * convertToMilightColor
 * INPUT: hue_color beteen 0 - 1
 * OUTPUT: milight_color between 0 - 255
 */
function convertToMilightColor ( hue_color )  {
	var milight_color = (256 + 176 - Math.floor(Number(hue_color) * 255.0)) % 256;
	return milight_color;
}

// Discover available Bridges
function discoverBridges () {
	var message = new Buffer ('Link_Wi-Fi');
	var server = dgram.createSocket("udp4");

	server.bind( function() {
	  server.setBroadcast(true)
	  server.setMulticastTTL(128);
	  setInterval(broadcastNew, 5000);
	});
	
	// Broadcast a new discover message
	function broadcastNew() {
		getDiscoverIp ( function(err, discoverIp) {
			console.log("Send broadcast message with ip: ", discoverIp);
			server.send(message, 0, message.length, 48899, discoverIp);
		})
	} 

	//empty foundDevices once a day
	function resetFoundDevices() {
		foundDevices = [];
	}
	setInterval(resetFoundDevices, 86400000);

	// Listen for emission of the "message" event.
	server.on('message', function (message, remote) {
	    message = message.toString('utf-8');
	    message = message.split(",");
	    var uuid = message[1];

	    var device = {
		    address		: remote.address,
		    uuid		: uuid
	    }
	    
		foundEmitter.emit('bridgeFound', device); //Emit a bridge is found

	    if (foundDevices.indexOf(remote.address) > -1) { // If address is already in the array
		    //Do nothing
		} else {
			foundDevices.push(remote.address);
		    foundEmitter.emit('newBridgeFound', device); //Emit a NEW bridge is found
		}
	});
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

// Get the Discover Ip based on Homeys IP to discover devices
function getDiscoverIp( callback ) {
	Homey.manager('cloud').getLocalAddress(function( err, address){
        var address = address.split(":");
		address = address[0]; //Remove the port
		address = address.split(".");
		address = address[0] + "." + address[1] + "." + address[2] + ".255"; //Get first three int and then .255
        callback (null, address); // Returns Homey's IP with .255 at the end (for example: 192.168.1.255)
    });
}

// Used during pairing to format the device in such a way that is possible to use 'list devices'
function formatDevice( device ) {
	var array = [
		{
			name: 'Color Group 1: Bridge (' + device.uuid + ')',
			data: {
				id: device.uuid + "-1",
				uuid: device.uuid,
				ip: device.address,
				group: "1",
	            state: true,
	            dim: 1,
	            color: 1,
	            temperature: 1
	        }
    	},
		{
			name: 'Color Group 2: Bridge (' + device.uuid + ')',
			data: {
				id: device.uuid + "-2",
				uuid: device.uuid,
				ip: device.address,
				group: "1",
	            state: true,
	            dim: 1,
	            color: 1,
	            temperature: 1
	        }
    	},
		{
			name: 'Color Group 3: Bridge (' + device.uuid + ')',
			data: {
				id: device.uuid + "-3",
				uuid: device.uuid,
				ip: device.address,
				group: "1",
	            state: true,
	            dim: 1,
	            color: 1,
	            temperature: 1
	        }
    	},
		{
			name: 'Color Group 4: Bridge (' + device.uuid + ')',
			data: {
				id: device.uuid + "-4",
				uuid: device.uuid,
				ip: device.address,
				group: "1",
	            state: true,
	            dim: 1,
	            color: 1,
	            temperature: 1
	        }
    	}
	];

	console.log(array);	
	return array;
}

module.exports = self;