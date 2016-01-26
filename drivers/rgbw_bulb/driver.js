"use strict";

var Milight = require('node-milight-promise').MilightController;
var commands = require('node-milight-promise').commands;
var devices = [];

var util		= require('util');
var events		= require('events');
var dgram 		= require('dgram');

var newDevices 			= [];

function MyEmitter() {
	
	events.EventEmitter.call(self);
	
}
util.inherits( MyEmitter, events.EventEmitter );

var myEmitter = new MyEmitter();

var light = new Milight({
    host: "192.168.1.255", //use .225 at the end to do a search
    delayBetweenCommands: 50,
    broadcast: true
});
		
var self = {
	
	init: function( devices_homey, callback ){ // we're ready
		Homey.log("The driver of MiLight RGBW bulb started");

		discoverBridges();

		devices_homey.forEach(function(device_data){ //Loopt trough all registered devices

				devices.push(device_data) // Push every device to the local devices list
				module.exports.setUnavailable( device_data, "Offline" );

			});
		
		myEmitter.on('bridgeFound', function(device){
			console.log("bridgeFound", device);
		
			devices_homey.forEach(function(device_data){
			
				connectToDevice( device, device_data, function(){} );
				
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
			newDevices = false;
		}),
		
		socket.on( "list_devices", function( data, callback ){
			Homey.log("List devices", data);

			// when a new device has been found
			myEmitter.on('bridgeFound', function(device){
				if (newDevices == false) {
					console.log("false");
					socket.emit('list_devices', formatDevice(device));
					newDevices.push(formatDevice(device));
				} else {
					newDevices.forEach(function(device_){
						if( device_[0].data.uuid != device.uuid ) {
							socket.emit('list_devices', formatDevice(device));
						    newDevices.push(device);
						}
					})
				}
			})
		}),

		socket.on( "add_device", function( device, callback ){
			Homey.log("Add device", device);

			var deviceObj = false;
			devices.forEach(function(device_){
				if( device_.uuid == device.data.id ) deviceObj = device_;
			})
			
			module.exports.setUnavailable( device.data, "Offline" );
			
			connectToDevice( deviceObj, device.data, function( err, result ){
				if( err ) return Homey.error(err);
			});

			newDevices = {};
			
			callback( null, true );
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

// Get the Color of a group
function getLightTemperature( active_device, callback ) {
	devices.forEach(function(device){ //Loopt trough all registered devices

		if (active_device.group == device.group) {
			console.log("getColor callback", device.temperature);
			callback( null, device.temperature );
		}
	});
}

// Set the Color of a group
function setLightTemperature( active_device, temperature, callback ) {
	console.log("settemperature: ", temperature);

	devices.forEach(function(device){ //Loopt trough all registered devices

		if (active_device.group == device.group) {

			light.sendCommands(commands.rgbw.on(device.group), commands.rgbw.whiteMode(device.group), commands.rgbw.brightness(temperature*100));

			device.temperature = temperature; //Set the new temperature
			callback( null, device.temperature ); //Calback the new temperature
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

function discoverBridges () {
	var message = new Buffer ('Link_Wi-Fi');
	var server = dgram.createSocket("udp4");
	var foundDevices = [];

	server.bind( function() {
	  server.setBroadcast(true)
	  server.setMulticastTTL(128);
	  setInterval(broadcastNew, 5000);
	});
	
	// Broadcast a new discover message
	function broadcastNew() {
	    server.send(message, 0, message.length, 48899, "192.168.1.255");
	    console.log(getDiscoverIp());
	    console.log("Send broadcast message");
	} 

	// Listen for emission of the "message" event.
	server.on('message', function (message, remote) {
		console.log("Response messages", message);
	    message = message.toString('utf-8');
	    message = message.split(",");
	    var uuid = message[1];

	    foundDevices.push(remote.address);

	    var device = {
		    address		: remote.address,
		    uuid		: uuid
	    }
	    
	    myEmitter.emit('bridgeFound', device);
	});
}

function connectToDevice( device, device_data, callback ) {
	console.log("Connect to device");
	console.log(devices);
	console.log(arguments);

	callback = callback || function(){}
				
	// map uuid to IP
	devices.forEach(function(device_){
		console.log(device_.uuid, device_data.uuid);
		if( device_.uuid == device_data.uuid ) {
			device_.ip = device_data.ip; // Set the new IP in the local devices list
			module.exports.setAvailable( device_data ); // Mark the device as available
			callback ( null, ip);
		}
	})
	
}

function getDiscoverIp() {
	Homey.manager('cloud').getLocalAddress(function( err, address){
        var address = address.split(":");
		address = address[0]; //Remove the port
		address = address.split(".");
		address = address[0] + "." + address[1] + "." + address[2] + ".255"; //Get first three int and then .255
		console.log("ADDRESS", address);
        return address; // Returns Homey's IP with (for example: 192.168.1.255)
    });
}

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