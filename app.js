"use strict";

var events		 = require('events');
var dgram 		 = require('dgram');
var Emitter      = require('events').EventEmitter;
var foundDevices = [];

var self = {
	init: function () {
		Homey.log("MiLight app started");

		self.foundEmitter = new Emitter();

		self.discoverBridges();
	},

	// Discover available Bridges
	discoverBridges: function() {
		var message = new Buffer ('Link_Wi-Fi');
		var server = dgram.createSocket("udp4");

		server.bind( function() {
		  server.setBroadcast(true)
		  server.setMulticastTTL(128);
		  setInterval(broadcastNew, 5000);
		});
		
		// Broadcast a new discover message
		function broadcastNew() {
			self.getDiscoverIp ( function(err, discoverIp) {
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
		    
		    console.log("A bridge was found: ", device);
			self.foundEmitter.emit('bridgeFound', device); //Emit a bridge is found

		    if (foundDevices.indexOf(remote.address) > -1) { // If address is already in the array
			    //Do nothing
			} else {
				foundDevices.push(remote.address);
			    self.foundEmitter.emit('newBridgeFound', device); //Emit a NEW bridge is found
			}
		});
	},

	// Get the Discover Ip based on Homeys IP to discover devices
	getDiscoverIp: function( callback ) {
		Homey.manager('cloud').getLocalAddress(function( err, address){
	        var address = address.split(":");
			address = address[0]; //Remove the port
			address = address.split(".");
			address = address[0] + "." + address[1] + "." + address[2] + ".255"; //Get first three int and then .255
	        callback (null, address); // Returns Homey's IP with .255 at the end (for example: 192.168.1.255)
	    });
	}
}

module.exports = self;