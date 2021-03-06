const Datastore = require('nedb');
const crypto = require("crypto");
const objectHash = require('object-hash');
const fse = require('fs-extra');
const path = require('path');

var Utils = {

	serverUrl: null,

	getApiUrl(path) {
		if (this.serverUrl === null) {
			console.log('WARN: Server has not started yet, Utils.getApiUrl() is not available yet.');
		}
		return this.serverUrl + path;
	},

	getServerUrl() {
		if (this.serverUrl === null) {
			console.log('WARN: Server has not started yet, Utils.getServerUrl() is not available yet.');
		}
		return this.serverUrl;
	},

	toISODate(timestamp) {
		return (new Date(timestamp)).toISOString();
	},
	
	encodeQueryParams(data) {
		let ret = [];
		for (let d in data) {
			ret.push(encodeURIComponent(d) + '=' + encodeURIComponent(data[d]));
		}
		return ret.join('&');
	},

	isObject(obj) {
		return (obj === Object(obj) && !Array.isArray(obj));
	},
	
	size(obj) {
		if (obj === null) {
			return 0;
		}
		return Object.keys(obj).length;
	},

	loadDB(name) {
		var db = new Datastore({ filename: './storage/database/' + name + '.db', autoload: true });
		db.persistence.setAutocompactionInterval(60 * 60 * 1000); // Once every hour
		return db;
	},

	generateHash(length = 16) {
		return crypto.randomBytes(Math.ceil(length/2)).toString('hex').slice(0,length);
	},

	encryptPassword(password){
		return this.hashPassword(password, this.generateHash(16));
	},

	hashPassword(password, salt){
		var hash = crypto.createHmac('sha512', salt);
		hash.update(password);
		return {
			salt: salt,
			passwordHash: hash.digest('hex')
		};
	},

	hashJSON(json) {
		return objectHash.sha1(json);
	},

	getTimestamp() {
		return Math.floor(Date.now() / 1000);
	},

	getISODateTime() {
		return (new Date()).toISOString().replace(/\.\d{3}/, '');
	},

	geoJsonToFeatureCollection(geojson) {
		let feature = null;
		switch(geojson.type) {
			case 'Point':
			case 'MultiPoint':
			case 'LineString':
			case 'MultiLineString':
			case 'Polygon':
			case 'MultiPolygon':
			case 'GeometryCollection':
			case 'Feature':
				feature = ee.FeatureCollection(ee.Feature(geojson));
				break;
			case 'FeatureCollection':
				var features = [];
				for(var i in geojson.features) {
					features.push(ee.Feature(geojson.features[i]));
				}
				feature = ee.FeatureCollection(features);
				break;
		}
		return feature;
	},

	getFileExtension(file) {
		return file.split('.').pop();
	},

	extensionToMediaType(ext) {
		ext = this.getFileExtension(ext);
		switch(ext.toLowerCase()) {
			case 'png':
				return 'image/png';
			case 'jpeg':
				return 'image/jpeg';
			case 'json':
				return 'application/json';
			default:
				return 'application/octet-stream';
		}
	},

	walk(dir) {
		return fse.readdir(dir).then(files => {
			return Promise.all(files.map(file => {
				const filepath = path.join(dir, file);
				return fse.stat(filepath).then(stats => {
					if (stats.isDirectory()) {
						return walk(filepath);
					}
					else if (stats.isFile()) {
						return Promise.resolve({
							path: filepath,
							stat: stats
						});
					}
				});
			}))
			.then((foldersContents) => {
				return Promise.resolve(foldersContents.reduce((all, folderContents) => all.concat(folderContents), []));
			});
		});
	}

};

module.exports = Utils;
