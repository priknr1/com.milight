"use strict";

var bridges = {};
var lights  = {};

var self = {
	init: function () {
		Homey.log("MiLight app started");

		/*var dgram = require('dgram');
		var client = dgram.createSocket('udp4');

		var message = new Buffer ('Link_Wi-Fi');

		setInterval(function(){
			console.log("Loop")
			var client = dgram.createSocket('udp4');
			client.send(message, 0, message.length, 48899, '192.255.255.255', function(err, bytes) {
		    if (err) throw err;
		    console.log('UDP message sent to ' + '192.255.255.255' +':'+ 48899);
			});
		}, 100);
		


		var server = dgram.createSocket('udp4');

		// Listen for emission of the "message" event.
		server.on('message', function (message, remote) {
		    console.log(remote.address + ':' + remote.port +' - ' + message);
		});

		// Bind to port 4000
		var port = 48899;
		server.bind(port);

		/*var PORT = '80';
		//var HOST = '192.255.255.255';
		var HOST = '127.0.0.1';

		var dgram = require('dgram');
		var server = dgram.createSocket('udp4');
		var server2 = dgram.createSocket('udp4');

		var message = "Link_Wi-Fi";

		server.send(message, 0, message.length, "48899", "192.255.255.255", function(err, bytes) {
		    if (err) throw err;
		    console.log('UDP message sent to ' + HOST +':'+ PORT);
		    server.close();
		});

		server2.on('listening', function () {
		    var address = server.address();
		    console.log('UDP Server listening on ' + address.address + ":" + address.port);
		});

		server2.on('message', function (message, remote) {
		    console.log(remote.address + ':' + remote.port +' - ' + message);

		});

		server2.bind(PORT, HOST);*/

		//self.refreshBridges();
	},

	/*
		Get a bridge by ID
	*/
	getBridge: function( bridge_id ) {
		return bridges[ bridge_id ] || new Error("invalid bridge id");
	},

	/*
		Get a light
	*/
	getLight: function( light_id ) {
		return lights[ light_id ] || new Error("invalid light_id")
	},

	/*
		Get a bridge and refresh it's state
	*/
	refreshBridges: function( bridge_id, callback ) {
		
		callback = callback || function(){}
							
		// get the bridge
		var bridge = self.getBridge( bridge_id );
		if( bridge instanceof Error ) return Homey.error(bridge);
				
	}
}

module.exports = self;