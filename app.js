"use strict";

var Milight = require("milight");
var bridges = {};
var lights  = {};

var self = {
	init: function () {
		Homey.log("MiLight app started");

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