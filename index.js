var Emitter = require('emitter');
module.exports = createModel;

var collectionConstructor = require('observable-collection');

function ModelBase () {}

ModelBase.prototype.toJSON = function () {
    var obj = {}
    var schema = this.schema
    var me = this
    Object.keys(schema.properties).forEach(function (prop) {
        var subObj = me[prop]

        var propType = typeof subObj

        switch (propType) {
            case 'object':
                if (subObj === null) {
                    obj[prop] = null
                } else {
                    if (subObj.toJSON) {
                        obj[prop] = subObj.toJSON() 
                    } else {
                        obj[prop] = subObj
                    }
                }
                break;
            case 'string':
                obj[prop] = subObj
                break;
            case 'number':
                obj[prop] = subObj
                break;
            case 'boolean':
                obj[prop] = subObj
                break;
        }
    })

    return obj
}

function createModel(name, schema, rootSchema) {
    function Model(data) {
        if (!(this instanceof Model)) {
            return new Model(data);
        }
        if (data) {
            if (typeof data == 'string' || typeof data == 'number') {
                this.id = data
                if (typeof this.load == 'function') {
                    this.load()
                }
            } else {
                this.set(data);
            }
        } else {
            this.setDefaults();
        }
        var obj = this;
        Object.keys(this.schema.properties).forEach(function (prop) {
            var value = obj[prop];
            Object.defineProperty(obj, prop, {
                get: function () {
                    return value;
                },
                set: function (v) {
                    var oldValue = value;
                    value = v;
                    obj.emit('change ' + prop, v, oldValue);
                }
            });
        });
    }

    Model.prototype = new ModelBase();
    Model.prototype.constructor = Model;
    Model.prototype.setValue = function (schema, property, value) {
        if (schema && schema.type == 'array') {
            if (this[property] && this[property].reset) {
                return this[property].reset(value.models)
            }
        }
        this[property] = value
    }
    Model.prototype.set = function (attrs) {
        var instance = this;
        var initialProperties = Object.keys(attrs)
        initialProperties.forEach(function (property) {
            var schema = instance.schema.properties[property]
            var val = instance.getValue(schema, attrs[property]);
            instance.setValue(schema, property, val)
        });
        
        this.setDefaults(initialProperties)
    };

    Model.prototype.setDefaults = function (excludeProperties) {
        var instance = this
        excludeProperties = excludeProperties || []
        Object.keys(instance.schema.properties).forEach(function (prop) {
            if (excludeProperties.indexOf(prop) == -1) {
                var defaultValue = instance.schema.properties[prop]['default'];
                if (typeof defaultValue !== 'undefined') {
                    defaultValue = JSON.parse(JSON.stringify(defaultValue));
                    defaultValue = instance.getValue(instance.schema.properties[prop], defaultValue)
                    instance.setValue(instance.schema.properties[prop], prop, defaultValue)
                }
            }
        })
    }

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

    Model.prototype.changes = function () {
        return patches(this)
    }

    Model.schema = function (schema) {
        this.prototype.schema = schema;
        return this;
    };

    Model.attr = function (name, schema) {
        schema = unwrapSchema(schema)

        if (Array.isArray(schema)) {
            var subSchema = unwrapSchema(schema.pop());

            schema = {
                id: name,
                type: 'array',
                items: subSchema
            }
        }

        this.prototype.schema.properties[name] = schema || {};
        return this;
    };

    if (schema) {
        traverseSchema(schema, function (subSchema, parent, property, rootSchema) {
            if (subSchema.$ref) {
                var referencedSchema = resolvePointer(rootSchema, subSchema.$ref)
                Object.defineProperty(parent, property, {
                    get: function () { return referencedSchema; }
                })
            }
        }, rootSchema)
        Model.prototype.schema = schema;
    }
    Model.prototype.schema.constructor = Model

    Model.prototype.getValue = function(propertySchema, value) {
        var me = this
        if (typeof propertySchema == 'undefined') propertySchema = { type: 'string' };

        if (propertySchema.$ref) {
            propertySchema = resolvePointer(this.schema, propertySchema.$ref)
        }

        if (propertySchema.hasOwnProperty(constructor)) {
            return new propertySchema.constructor(value);
        }

        return ({
            'array': function () {
                var arr = value.map(function (item) {
                    return me.getValue(propertySchema.items, item);
                })
                return new collectionConstructor(arr);
            },
            'object': function () {
                if (!propertySchema.properties) {
                    return value;
                } else {
                    if (propertySchema.constructor == Object) {
                        propertySchema.constructor = createModel(propertySchema.id || 'auto created', propertySchema, rootSchema)
                    }

                    if (propertySchema.constructor !== Object) {
                        return new propertySchema.constructor(value)
                    }

                    var o = {};
                    Object.keys(propertySchema.properties).forEach(function (property){
                        o[property] = me.getValue(propertySchema.properties[property], value[property]);
                    });
                    return o;
                }
            },
            'string': function () {
                return value;
            },
            'boolean': function () {
                return value;
            },
            'number': function () {
                return value;
            }
        })[propertySchema.type || 'string']();
    }


    return Model;
}

function traverseSchema (schema, cb, root, parent, property) {
    root = root || schema
    
    if (schema.properties){
        var props = Object.keys(schema.properties);
        for (var i=0; i<props.length; i++) {
            var p = props[i]
            var subSchema = schema.properties[p];
            traverseSchema(subSchema, cb, root, schema.properties, p)
        }
    }

    if (schema.items) {
        traverseSchema(schema.items, cb, root, schema, 'items')
    }

    cb(schema, parent, property, root)
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

// A Model can be given instead of a schema
function unwrapSchema(schema) {
    if (schema && (schema.prototype instanceof ModelBase)) {
        schema = schema.prototype.schema;
    }
    return schema;
}



function isArrayLike (o) {
    return typeof o.forEach === 'function'
}

function argmap (map) {
    return function (fn) {
        return function () {
            var args = [].slice.call(arguments)
            var mappedArgs = map.apply(null, args)

            fn.apply(null, mappedArgs)
        }
    }
}

function reporter(inner, namespace) {
    if (arguments.length < 2)  {
        namespace = inner
        inner = void 0
    }

    namespace = namespace || ''
    namespace += '/'

    if (!inner) {
        var handlers = []
        inner = handlers.push.bind(handlers)
        inner.emit = argmap(function (op, path, val, from) {
            var patch = {
                op: op,
                path: path
            }
            switch (op) {
                case 'remove':
                    break;
                case 'replace':
                case 'add':
                    patch.value = val
                    break;
                case 'move':
                    patch.from = from
                    break;
                default:
                    throw new Error('Dont recognize op', op)
            }
            return [patch];
        })(multiplex(handlers))
    }
    var path = namespace || ''
    function observe(h) {
        inner(h)
    }

    observe.emit = function (op, path, val, from) {
        inner.emit(op, namespace + path, val, (from !==void 0) && (namespace + from))
    }

    observe.namespaced = function (n) {
        return reporter(observe, n)
    }
    return observe
}

function multiplex (arr, context) {
    return function () {
        var args = [].slice.call(arguments)
        arr.forEach(function (f) {
            f.apply(context, args)
        })
    }
}

function unwrap (o) {
    if (typeof o == 'object' && o!== null && typeof o.toJSON == 'function') {
        return o.toJSON()
    }
    return o
}

function resolvePointer(root, pointer) {
    pointer = pointer.split('#').pop()
    /* Currently only absolute pointers are allowed */
    var parts = pointer.split('/').slice(1)

    var ref = root
    for(var i = 0; i<parts.length; i++) {
        ref = ref[parts[i]]
    }
    return ref;
}

function patches (o, emitter) {
    if (!emitter) {
        emitter = reporter()
    }

    if (isArrayLike(o)) {
        function watchItem (item, index) {
            patches(item, emitter.namespaced(index.toString()))
        }

        function unwatchItem() {
            console.warn('Implement unwatchItem!!!')
        }

        if (o.on) {
            o.on('add', function (item, index) {
                emitter.emit('add', index, unwrap(item))
                watchItem(item, index)
            })
            o.on('remove', function (item, index) {
                emitter.emit('remove', index, unwrap(item))
                unwatchItem(item, index)
            })
            o.on('replace', function (index, oldItem, newItem) {
                emitter.emit('replace', index, unwrap(newItem))
            })
            o.on('move', function (fromIndex, toIndex, item) {
                emitter.emit('move', toIndex, unwrap(item), fromIndex)
            })
        }
        o.forEach(function (item, index) {
            watchItem(item, index)
        })
    } else {
        if (!o.schema) return emitter;

        var props = o.schema.properties
        var keys = Object.keys(o.schema.properties)

        keys.forEach(function (key) {
            if (o.on) {
                o.on('change ' + key, function (newVal) {
                    emitter.emit('replace', key, unwrap(newVal))
                })
            } else {
                //console.log('not watching', key, o)
            }

            var prop = o[key]
            if (typeof prop === 'object' && prop !== null) {
                patches(o[key], emitter.namespaced(key))
            }
        })
    }

    return emitter;
}