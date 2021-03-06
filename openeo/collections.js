const Utils = require('./utils');
const Errors = require('./errors');
const fse = require('fs-extra');
const {Storage} = require('@google-cloud/storage');

module.exports = class Data {

	constructor() {
		this.dataFolder = 'storage/collections/';

		this.collections = {};

		this.geeSourceCatalogLink = {
			href: 'https://storage.cloud.google.com/earthengine-stac/catalog/catalog.json', 
			rel: 'alternate',
			type: 'application/json',
			title: 'Machine-readable Earth Engine Data Catalog'
		},
		this.geeBrowsableCatalogLink = {
			rel: 'alternate',
			href: 'https://developers.google.com/earth-engine/datasets/catalog/',
			type: 'text/html',
			title: 'Human-readable Earth Engine Data Catalog'
		};

	}

	beforeServerStart(server) {
		server.addEndpoint('get', '/stac', this.getStacRootCatalog.bind(this));
		server.addEndpoint('get', '/collections', this.getCollections.bind(this));
		server.addEndpoint('get', ['/collections/{collection_id}', '/collections/*'], this.getCollectionById.bind(this));

		return this.loadCatalog();
	}

	readLocalCatalog() {
		this.collections = {};
		var files = fse.readdirSync(this.dataFolder, {withFileTypes: true});
		for(var i in files) {
			let file = files[i];
			if (file.isFile() && file.name !== 'catalog.json') {
				let collection = fse.readJsonSync(this.dataFolder + file.name);
				this.collections[collection.id] = collection;
			}
		}
	}

	updateCatalog() {
		// To refresh the catalog manually, delete the catalog.json.
		let catalogFile = this.dataFolder + 'catalog.json';
		if (fse.existsSync(catalogFile)) {
			let fileTime = new Date(fse.statSync(catalogFile).ctime).getTime();
			let expiryTime = new Date().getTime() - 24 * 60 * 60 * 1000; // Expiry time: A day
			if (fileTime > expiryTime) {
				return Promise.resolve();
			}
		}

		console.log('Refreshing GEE catalog...');
		const storage = new Storage({
			keyFile: './privatekey.json'
		});
		const bucket = storage.bucket('earthengine-stac');
		const prefix = 'catalog/';
		return bucket.getFiles({
			prefix: prefix
		})
		.then(data => {
			let promises = [];
			for(var i in data[0]) {
				let file = data[0][i];
				promises.push(file.download({
					destination: this.dataFolder + file.name.replace(prefix, '')
				}));
			};
			return Promise.all(promises);
		});
	}

	loadCatalog() {
		return this.updateCatalog().then(() => {
			this.readLocalCatalog();
			console.log("Loaded catalog with " + Utils.size(this.collections) + " collections.");
			return Promise.resolve();
		});
	}

	getData(id = null, isSTAC = false) {
		if (id !== null) {
			if (typeof this.collections[id] !== 'undefined') {
				return this.fixData(this.collections[id], isSTAC);
			}
			else {
				return null;
			}
		}
		else {
			return Object.values(this.collections).map(collection => {
				return this.fixData(collection, isSTAC);
			})
		}
	}

	fixData(collection, isSTAC = false) {
		var c = Object.assign({}, collection);
		if (!isSTAC) {
			c.name = c.id;
			c.provider = c.providers;
			delete c.providers;
			delete c.stac_version;
			if (typeof c === 'object' && Utils.isObject(c.properties)) {
				for(let key in c.properties) {
					c[key] = c.properties[key];
				}
				delete c.properties;
			}
			if (c['eo:bands'] && Array.isArray(c['eo:bands'])) {
				let bands = {};
				for(let i in c['eo:bands']) {
					let b = c['eo:bands'][i];
					let name = typeof b.name === 'string' ? b.name : i;
					bands[name] = b;
				}
				c['eo:bands'] = bands;
			}
		}
		c.links = c.links.map(l => {
			let stacSuffix = isSTAC ? "?stac": "";
			switch(l.rel) {
				case 'self':
					l.href = Utils.getApiUrl("/collections/" + c.id + stacSuffix);
					break;
				case 'parent':
				case 'root':
					l.href = Utils.getApiUrl((isSTAC ? "/stac" : "/collections") + stacSuffix);
					break;
			}
			return l;
		});
		return c;
	}
	
	getStacRootCatalog(req, res, next) {
		var response = {
			stac_version: "0.6.0",
			id: "openeo-earthengine-driver",
			description: "Google Earth Engine catalog for openEO.",
			links: [
				{
					rel: "self",
					href: Utils.getApiUrl("/stac")
				},
				{
					rel: "alternate",
					href: Utils.getApiUrl("/collections"),
					title: "WFS3 Collections",
					type: "application/json"
				},
				this.geeBrowsableCatalogLink,
				this.geeSourceCatalogLink
			]
		};

		this.getData(null, true).map(d => {
			response.links.push({
				rel: "child",
				href: Utils.getApiUrl("/collections/" + d.id + "?stac"),
				title: d.title,
				type: "application/json"
			});
		});

		res.json(response);
		return next();
	}

	getCollections(req, res, next) {
		var data = this.getData().map(d => {
			return {
				name: d.name,
				title: d.title,
				description: d.description,
				license: d.license,
				providers: d.providers,
				extent: d.extent,
				links: d.links
			};
		});
		res.json({
			collections: data,
			links: [
				{
					rel: "self",
					href: Utils.getApiUrl("/collections")
				},
				{
					rel: "alternate",
					href: Utils.getApiUrl("/stac"),
					title: "STAC API",
					type: "application/json"
				},
				this.geeBrowsableCatalogLink,
				this.geeSourceCatalogLink
			]
		});
		return next();
	}
	
	getCollectionById(req, res, next) {
		var id = req.params['*'];
		if (id.length === 0) {
			// Redirect to correct route
			return this.getCollections(req, res, next);
		}

		var isSTAC = (typeof req.query.stac !== 'undefined');
		var collection = this.getData(id, isSTAC);
		if (collection !== null) {
			res.json(collection);
			return next();
		}
		else {
			return next(new Errors.CollectionNotFound());
		}
	}

};
