'use strict';

const dgram = require('dgram');
const _ = require('underscore');

const discoverBridges = require('node-milight-promise').discoverBridges;

const Bridge = require('./Bridge');

const BRIDGE_POLL_INTERVAL = 30000;
const OFFLINE_THRESHOLD = 1;
const OFFLINE_MARKED = 5;
const DEBUG = true;

class BridgeManager {

	/**
	 * Construct BridgeManager object, directly start polling for bridge availability.
	 */
	constructor() {

		// Array holding bridges found
		this.bridges = [];

		// Keep checking if bridges are available
		this.startPollingBridge();
		this.discoveryPromises = [];

		_log('created BridgeManager');
	}

	/**
	 * Discover bridges, by default all types with a timeout of 10 seconds. Override options object with properties
	 * defined by node-milight-promise (discoverBridges).
	 * @param options
	 * @returns {Promise}
	 */
	_discoverBridges(options) {

		// If already discovering return dummy promise
		if (this.discovering) return new Promise((resolve, reject) => this.discoveryPromises.push({ resolve, reject }));
		this.discovering = true;

		// Construct options object
		options = Object.assign({
			type: 'all',
			timeout: 3000,
		}, options);

		// Perform discovery and resolve all discoveryPromises when done
		const discoveryPromise = discoverBridges(options).then(result => {
			this.discoveryPromises.forEach(promise => promise.resolve(result));
			this.discovering = false;
			return result;
		}).catch(err => {
			this.discoveryPromises.forEach(promise => promise.reject(err));
			this.discovering = false;
			return err;
		});

		return discoveryPromise;
	}

	/**
	 * Searches the registered bridges for the requested bridge.
	 * @param query {Object, String} Object with 'mac' property, or string representing mac address
	 * @returns {Bridge|Error}
	 */
	getBridge(query) {
		if (!query) return new Error('missing_mac_parameter');
		if (typeof query !== 'string' && typeof query !== 'object') return new TypeError('invalid_query_parameter');

		// Extract mac address from query
		const mac = (typeof query === 'string') ? query : query.mac;
		if (typeof mac === 'undefined') return new Error('could_not_find_mac_value_in_query');

		const available = (typeof query === 'object' && query.hasOwnProperty('available') && query.available);

		_log(`getBridge() -> mac: ${mac}`);

		// Find and return bridge object if possible
		const bridge = this.bridges.find(obj => obj.mac === mac && (!available || (available && obj.unavailableCounter === 0)));
		if (typeof bridge === 'undefined') return new Error('could_not_find_bridge');
		return bridge;
	}

	/**
	 * Check if bridge object is already registered.
	 * @param bridge {Bridge}
	 * @returns {Boolean|Error}
	 */
	hasBridge(bridge) {
		if (!bridge) return new Error('missing_bridge');

		const result = this.getBridge(bridge);
		if (result instanceof Error) return false;

		// Return as boolean value
		return typeof result !== 'undefined';
	}

	/**
	 * Update a bridge if a new bridge object has been found during discovery, in case the bridge was assigned a new IP
	 * update that property on the bridge.
	 * @param targetBridge {Bridge}
	 * @param newBridge {Bridge}
	 * @returns {Bridge|Error}
	 */
	updateBridge(targetBridge, newBridge) {
		const bridge = this.getBridge(targetBridge);
		if (bridge instanceof Error) return new Error('failed_to_update_bridge_not_found');

		_log(`updateBridge() -> update IP of bridge from ${bridge.ip} to ${newBridge.ip}`);

		// Update ip of bridge
		bridge.updateIPAddress(newBridge.ip);

		return bridge;
	}

	/**
	 * Register a bridge with the manager. If already added before it will update the bridge if necessary.
	 * @param bridge {Bridge}
	 * @param temp {Boolean} True if device needs to be added temporarily (will be removed after pairing if not registered)
	 * @returns {Bridge|Error}
	 */
	registerBridge(bridge, temp) {
		if (!bridge.ip) return new Error('missing_bridge_ip');
		if (!bridge.mac) return new Error('missing_bridge_mac');
		if (typeof bridge.name === 'undefined' && !bridge.bridgeVersion) return new Error('missing_bridge_name_or_version');

		_log(`registerBridge() -> bridge: ${bridge.mac}, temp: ${temp}, hasBridge() -> ${this.hasBridge(bridge)}`);

		// Check if bridge (mac address) is already registered
		if (this.hasBridge(bridge)) {

			// Then update the bridge currently in memory
			let registeredBridge = this.getBridge(bridge);

			// Only update if ip has changed
			if (registeredBridge.ip !== bridge.ip) {

				_log('registerBridge() -> bridge was already registered on a different ip, updating it');

				registeredBridge = this.updateBridge(registeredBridge, bridge);
				if (registeredBridge instanceof Error) return new Error('could_not_update_unknown_bridge');
			}

			_log('registerBridge() -> bridge was already registered');

			// Only mark bridge as temp = false when it was previously true and now explicitly false
			if (registeredBridge.temp === true && temp === false) registeredBridge.temp = false;
			return registeredBridge;
		}

		_log('registerBridge() -> new bridge, add it');

		const newBridge = new Bridge({
			temp,
			ip: bridge.ip,
			mac: bridge.mac,
			bridgeVersion: bridge.bridgeVersion || (typeof bridge.name !== 'undefined' && bridge.name === 'HF-LPB100') ? 6 : 5,
		}).on('destroy', bridge => {
			this.deregisterBridge(bridge);
		});

		_log('registerBridge() -> ', newBridge.mac);

		// If bridge was already registered
		if (this.hasBridge(newBridge)) {

			// Update it
			this.updateBridge(this.getBridge(newBridge), newBridge);

			// Cleanup bridge
			newBridge.destroy();
		} else {
			this.bridges.push(newBridge);
		}

		return this.getBridge(newBridge);
	}

	/**
	 * Deregister (removes) a bridge from the manager.
	 * @param bridge {Bridge}
	 */
	deregisterBridge(deregisterBridge) {

		_log(`deregisterBridge() -> remove ${deregisterBridge.mac} -> before`, this.bridges.length);

		const bridge = this.getBridge(deregisterBridge);
		const index = this.bridges.findIndex(b => b.mac === bridge.mac);

		// Remove it from the array
		this.bridges.splice(index, 1);

		_log(`deregisterBridge() -> removed ${deregisterBridge.mac} -> after`, this.bridges.length);

		return bridge;
	}

	/**
	 * Deregister (removes) bridges that were temporarily added during pairing from the manager.
	 */
	deregisterTempBridges() {
		_log('deregisterTempBridges() -> start, this.bridges.length', this.bridges.length);

		// Find bridges with flag temp = true
		const temporarilyAddedBridges = this.bridges.filter(bridge => bridge.temp === true);

		// Deregister them all
		temporarilyAddedBridges.forEach(bridge => {
			bridge.destroy();
			// this.deregisterBridge(bridge)
		});
		_log('deregisterTempBridges() -> end, this.bridges.length', this.bridges.length);
	}

	/**
	 * Discover and register bridges (tries again one time if discovery yielded no results).
	 * @param options
	 * @returns {Promise}
	 */
	discoverBridges(options) {

		_log('discoverBridges() -> starting bridge discovery', options);

		return this._discoverBridges(options)
			.then(bridges => {

				_log(`discoverBridges() -> found ${bridges.length} bridges`);

				// If discover bridges was called from pairing wizard add as temporary
				let temp = false;
				if (options && options.hasOwnProperty('temp')) temp = options.temp;

				const tempBridges = [];
				bridges.forEach(bridge => {
					tempBridges.push(this.registerBridge(bridge, temp));
				});

				// If we have results return them
				if (tempBridges.length > 0 || (options && options.noRetry)) return tempBridges;

				// If no results check if we are allowed to retry and do so
				if (options) options.noRetry = true;
				else options = { noRetry: true };
				return this.discoverBridges(options);
			})
			.catch(errorHandler);
	}

	/**
	 * On every interval perform a bridge discovery to keep track of bridges that are offline for multiple intervals.
	 * After three failed discovery attempts a bridge will be marked as unavailable. After a successful discovery the
	 * bridge will be marked as online again.
	 */
	startPollingBridge() {

		// Poll every [BRIDGE_POLL_INTERVAL] milliseconds to check if bridge is alive and if IP changed
		setInterval(() => {

			// If no bridges present no need to poll for availability
			if (this.bridges.length > 0) {

				_log('startPollingBridge() -> perform discovery');

				this._discoverBridges()
					.then(bridges => {

						_log(`startPollingBridge() -> discovery result ${bridges.length} bridges`);

						// Check for each registered bridge if its equivalent was found during discovery
						this.bridges.forEach(registeredBridge => {

							const online = _.findWhere(bridges, { mac: registeredBridge.mac });

							// If no response
							if (typeof online === 'undefined') {

								// And third time in a row no response
								if (registeredBridge.unavailableCounter > OFFLINE_THRESHOLD && registeredBridge.unavailableCounter !== OFFLINE_MARKED) {
									_log(`startPollingBridge() -> mark ${registeredBridge.mac} as offline (${registeredBridge.unavailableCounter})`);
									registeredBridge.emit('offline');
									registeredBridge.unavailableCounter = OFFLINE_MARKED;
								} else if (registeredBridge.unavailableCounter !== OFFLINE_MARKED) registeredBridge.unavailableCounter++;
							} else {

								if (registeredBridge.unavailableCounter === OFFLINE_MARKED) {
									_log(`startPollingBridge() -> mark ${registeredBridge.mac} as online`);

									// Refresh session with bridge
									if (registeredBridge.bridgeVersion === 6) registeredBridge.updateIPAddress();

									// Reset counter before emitting it is online
									registeredBridge.unavailableCounter = 0;
									registeredBridge.emit('online');
								}

								// Reset counter
								registeredBridge.unavailableCounter = 0;
							}
						});
					})
					.catch(errorHandler);
			}
		}, BRIDGE_POLL_INTERVAL);
	}

	/**
	 * First searches for a bridge in the registered bridges, if not found perform discovery to search for the bridge.
	 * @param mac {String} Representing bridge mac address
	 * @returns {Promise}
	 */
	findBridge(mac) {
		return new Promise((resolve, reject) => {
			_log(`findBridge() -> mac: ${mac}`);

			// First search registered bridges
			const bridge = this.getBridge({ mac, available: true });
			if (bridge instanceof Error) _log(`findBridge() -> ${mac} -> not found in registered bridges`);
			else if (bridge.unavailableCounter === 0) {
				return resolve(bridge);
			} else {
				_log(`findBridge() -> bridge found but unavailable (counter ${bridge.unavailableCounter}`);
			}

			_log(`findBridge() -> ${mac} -> start discovery`);

			// If not found in registered bridges perform discovery
			this.discoverBridges().then(() => {
				const bridge = this.getBridge({ mac, available: true });
				if (bridge instanceof Error) return reject('bridge_not_found_after_discovering');

				_log(`findBridge() -> ${mac} -> found bridge after discovering`);

				return resolve(bridge);
			}).catch(errorHandler);
		});
	}
}

/**
 * Log method, log level info.
 */
function _log() {
	if (!DEBUG) return;
	const args = Array.prototype.slice.call(arguments);
	args.unshift('[info] BridgeManager.js');
	args.unshift('\t');
	args.unshift(timestamp());
	console.log.apply(null, args);
}

/**
 * Log method, log level error.
 */
function _error() {
	if (!DEBUG) return;
	const args = Array.prototype.slice.call(arguments);
	args.unshift('[error] BridgeManager.js');
	args.unshift('\t');
	args.unshift(timestamp());
	console.error.apply(null, args);
}

/**
 * Create current timestamp,
 * HH:MM:SS:sss
 * @returns {string}
 */
function timestamp() {
	const d = new Date();
	return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}:${pad(d.getMilliseconds())}`;
}

/**
 * Pad a value with zero if necessary.
 * @param value
 * @returns {string}
 */
function pad(value) {
	return (value < 10) ? `0${value}` : value;
}

/**
 * Promise error handler, make sure to always log the stack trace.
 * @param error
 * @returns {Promise.<*>}
 */
function errorHandler(error) {
	_error(error.stack);
	return Promise.reject(error);
}

module.exports = BridgeManager;
