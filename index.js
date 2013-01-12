var Emitter = require('emitter');
module.exports = createModel;

var collectionConstructor = require('observable-collection');

function ModelBase () {}

function createModel(name, schema) {
	function Model(data) {
		if (data) this.set(data);
		var obj = this;
		Object.keys(this.schema.properties).forEach(function (prop) {
			var value = obj[prop];
			Object.defineProperty(obj, prop, {
				get: function () { return value; },
				set: function (v) {
					value = v;
					this.emit('change ' + prop, v);
				}
			});
		});
	}

	Model.prototype = new ModelBase();
	Model.prototype.constructor = Model;

	Model.prototype.set = function (attrs) {
		var instance = this;
		Object.keys(attrs).forEach(function (property) {
			instance[property] = getValue(instance.schema.properties[property], attrs[property]);
		});
	};

	Emitter(Model);

	Emitter(Model.prototype);
	/*
	for(var prop in proto) {
		Model.prototype[prop] = proto[prop];
	}
	*/
	/*
	Object.defineProperty(this, 'schema', {
		get: function () { return this._schema; },
		set: function (val) { this._schema = val; },
		writeable: false,
		configurable: false
	});
	*/
	Model.prototype.schema = { properties: {} };
	Model.schema = function (schema) {
		this.prototype.schema = schema;
		return this;
	};

	Model.attr = function (name, schema) {
		if (schema && (schema.prototype instanceof ModelBase)) {
			schema = schema.prototype.schema;
		}

		this.prototype.schema.properties[name] = schema || {};
		return this;
	};

	if (schema) {
		Model.prototype.schema = schema;
	}
	
	return Model;
}

createModel.collection = function (Collection) {
	collectionConstructor = Collection;
	return this;
};

function setFn(instance) {
	return function (attrs) {
		Object.keys(attrs).forEach(function (property) {
			instance[property]( getValue(instance.schema.properties[property], attrs[property]) );
		});
	};
}

function getValue(propertySchema, value) {
	if (typeof propertySchema == 'undefined') propertySchema = { type: 'string' };

	if (propertySchema.type && propertySchema.type.$ref) {
		return new constructors[propertySchema.type.$ref](value);
	}

	return ({
		'array': function () {
			return new collectionConstructor(value.map(function (item) {
				return getValue(propertySchema.items, item);
			}));
		},
		'object': function () {
			if (!propertySchema.properties) {
				return value;
			} else {
				var o = {};
				Object.keys(propertySchema.properties).forEach(function (property){
					o[property] = getValue(propertySchema.properties[property], value[property]);
				});
				return o;
			}
		},
		'string': function () {
			return value;
		},
		'number': function () {
			return value;
		}
	})[propertySchema.type || 'string']();
}
