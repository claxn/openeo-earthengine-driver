module.exports = class Config {

	constructor() {
		// Set default that can be overriden by the config.json

		this.hostname = "127.0.0.1";
		this.apiPath = "/v0.3";
		this.apiVersion = "0.3.1";

		this.port = 80;
		this.ssl = {
			port: 443,
			key: null,
			certificate: null 
		};

		this.serviceAccountCredentialsFile = "privatekey.json";

		this.currency = null;
		this.plans = {
			default: null,
			options: []
		};

		this.outputFormats = {
			default: "PNG",
			options: {
				PNG: {
					gis_data_types: ['raster']
				},
				JPEG: {
					gis_data_types: ['raster']
				},
				JSON: {
					gis_data_types: ['raster', 'vector', 'table', 'other']
				}
			}
		};

		this.services = {
			xyz: {}
		};

		let config = require('../config.json');
		for(var c in config) {
			this[c] = config[c];
		}
	}

	isValidOutputFormat(format) {
		return (typeof format === 'string' && typeof this.outputFormats.options[format.toUpperCase()] === 'object');
	}

	isValidServiceType(service_type) {
		return (typeof service_type === 'string' && typeof this.services[service_type.toLowerCase()] === 'object');
	}

}