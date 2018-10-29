const eeUtils = require('../eeUtils');

module.exports = {
	process_id: "last_time",
	description: "Returns the last element of a time series for all bands of the input dataset.",
	parameters: {
		imagery: {
			description: "EO data to process.",
			required: true,
			schema: {
				type: "object",
				format: "eodata"
			}
		},
		null: {
			description: "Defines whether the last element is allowed to be null (`true`, default) or not (`false`).",
			schema: {
				type: "boolean",
				default: true
			}
		}
	},
	returns: {
		description: "Processed EO data.",
		schema: {
			type: "object",
			format: "eodata"
		}
	},
	eeCode(args, req, res) {
		return eeUtils.toImageCollection(args.imagery).reduce(args.null === true ? 'last' : 'lastNonNull');
	}
};