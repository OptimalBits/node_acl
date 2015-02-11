/**
 EJDB Backend.
 Implementation of the storage backend using EJDB

 * Needs indexing setup.
 * Needs implementation of clean function

 */
"use strict";

var contract = require('./contract');
var async = require('async');
var _ = require('lodash');

// Name of the collection where meta and allowsXXX are stored.
// If prefix is specified, it will be prepended to this name, like acl_resources
var aclCollectionName = 'resources';

function EJDBBackend(db, prefix, useSingle) {
    this.db = db;
    this.prefix = typeof prefix !== 'undefined' ? prefix : '';
    //this.useSingle = (typeof useSingle !== 'undefined') ? useSingle : false;
    this.useSingle = true;
    this.db.ensureCollection(aclCollectionName, {cachedrecords: 2048,large:true});
}

EJDBBackend.prototype = {
    /**
     Begins a transaction.
     */
    begin: function () {
        // returns a transaction object(just an array of functions will do here.)
        return [];
    },
    /**
     Ends a transaction (and executes it)
     */
    end: function (transaction, cb) {
        contract(arguments).params('array', 'function').end();
        async.series(transaction, function (err) {
            cb(err instanceof Error ? err : undefined);
        });
    },
    /**
     Cleans the whole storage.
     */
    clean: function (cb) {
        contract(arguments).params('function').end();
        // TODO: Not implemented...
    },
    /**
     Gets the contents at the bucket's key.
     */
    get: function (bucket, key, cb) {
        contract(arguments)
                .params('string', 'string|number', 'function')
                .end();
        key = encodeText(key);
        var searchParams = (this.useSingle ? {_bucketname: bucket, key: key} : {key: key});
        var collName = (this.useSingle ? aclCollectionName : bucket);

        //this.db.collection(this.prefix + collName, function (err, collection) {
        
        //console.log("Get: ", this.prefix + collName, searchParams);

        // Excluding bucket field from search result
        this.db.findOne(this.prefix + collName, searchParams, function (err, doc) {
            console.log("Getting stuff...", err, doc);
            
            if (err)
                return cb(err);
            if (!_.isObject(doc))
                return cb(undefined, []);
            doc = fixKeys(doc);
            
            console.log("get: without:",_.without(_.keys(doc), "key", "_id", "_bucketname"), bucket, key);
            
            cb(undefined, _.without(_.keys(doc), "key", "_id", "_bucketname"));
        });
    },
    /**
     Returns the union of the values in the given keys.
     */
    union: function (bucket, keys, cb) {
        console.log("union:", bucket, keys);
        contract(arguments)
                .params('string', 'array', 'function')
                .end();
        keys = encodeAll(keys);
        var searchParams = (this.useSingle ? {_bucketname: bucket, key: {$in: keys}} : {key: {$in: keys}});
        var collName = (this.useSingle ? aclCollectionName : bucket);

        //this.db.collection(this.prefix + collName, function (err, collection) {

        //console.log("Union: Asking for:", this.prefix + collName, searchParams, {_bucketname: 0});

        // Excluding bucket field from search result
        this.db.find(this.prefix + collName, searchParams, {_bucketname: 0}, function (err, cursor, length) {
            var docs = [];

            while (cursor.next()) {
                var doc = cursor.object();
                delete doc['_bucketname'];
                docs.push(doc);
            }
            
            //console.log("docs in union:", docs, length, "buckets and keys:", bucket, keys);
            
            if (err instanceof Error)
                return cb(err);
            if (!docs.length)
                return cb(undefined, []);
            var keyArrays = [];
            docs = fixAllKeys(docs);
            
            //console.log("union: fixed docs", docs);
            
            docs.forEach(function (doc) {
                keyArrays.push.apply(keyArrays, _.keys(doc));
            });
            
            console.log("union: done:", _.without(_.union(keyArrays), "key", "_id"));
            cb(undefined, _.without(_.union(keyArrays), "key", "_id"));
        });
    },
    /**
     Adds values to a given key inside a bucket.
     */
    add: function (transaction, bucket, key, values) {
        contract(arguments)
                .params('array', 'string', 'string|number', 'string|array|number')
                .end();

        if (key === "key")
            throw new Error("Key name 'key' is not allowed.");
        key = encodeText(key);
        var self = this;
        var updateParams = (self.useSingle ? {_bucketname: bucket, key: key} : {key: key});
        var collName = (self.useSingle ? aclCollectionName : bucket);

        transaction.push(function (cb) {
            values = makeArray(values);
            //self.db.collection(self.prefix + collName, function (err, collection) {
            
            // build doc from array values
            var doc = {};
            values.forEach(function (value) {
                doc[value] = true;
            });
            updateParams.$set = doc;

            console.log("add - update:", self.prefix + collName, updateParams);

            // update document
            //self.db.update(self.prefix + collName, updateParams, {$set: doc}, function (err) {
            self.db.find(self.prefix + collName, updateParams, function (err, cursor, length) {
                var l = [];
                while(cursor.next()) {
                    l.push(cursor.object());
                }

                if (length === 0) {
                    //self.db.save(self.prefix + collName, updateParams, {$upsert: doc}, function (err, oids) {
                    delete updateParams['$set'];
                    console.log("Add did not find the thing should save? ", updateParams, doc);

                    values.forEach(function (value) {
                        updateParams[value] = true;
                    });
                    
                    self.db.save(self.prefix + collName, updateParams, function (err, cursor, length) {
                        if (err instanceof Error)
                            return cb(err);
                        cb(null);
                    });            
                } else {
                    console.log("add: We're back and updated", err, arguments, l);
                    if (err instanceof Error)
                        return cb(err);
                    cb(undefined);
                }
            });
        });
    },
    /**
     Delete the given key(s) at the bucket
     */
    del: function (transaction, bucket, keys) {
        contract(arguments)
                .params('array', 'string', 'string|array')
                .end();
        keys = makeArray(keys);
        var self = this;
        var updateParams = (self.useSingle ? {_bucketname: bucket, key: {$in: keys}} : {key: {$in: keys}});
        var collName = (self.useSingle ? aclCollectionName : bucket);

        console.log("del: asking to delete these", keys, 'from', bucket, 'with', updateParams);

        transaction.push(function (cb) {
            //self.db.collection(self.prefix + collName, function (err, collection) {
            
            self.db.find(self.prefix + collName, updateParams, function (err, cursor, length) {
                if (err instanceof Error)
                    return cb(err);
                
                var l = [];
                while(cursor.next()) {
                    l.push(cursor.object()._id);
                }
                
                console.log("should delete these oids", l);
                
                if (l.length>0) {
                    var remove = function(l) {
                        self.db.remove(self.prefix + collName, l[0], function (err) {
                            console.log("deleted first from list", err, l[0]);
                            l = l.slice(1);
                            if (l.length>0) {
                                console.log("Remove again...", l.length);
                                setTimeout(function() { remove(l); });
                            } else {
                                console.log("all done..");
                                cb(undefined);
                            }
                        });
                    };
                    remove(l);
                } else {
                    cb(undefined);
                }
            });
        });
    },
    /**
     Removes values from a given key inside a bucket.
     */
    remove: function (transaction, bucket, key, values) {
        console.log("remove:", bucket, key, values);
        contract(arguments)
                .params('array', 'string', 'string|number', 'string|array|number')
                .end();
        key = encodeText(key);
        var self = this;
        var updateParams = (self.useSingle ? {_bucketname: bucket, key: key} : {key: key});
        var collName = (self.useSingle ? aclCollectionName : bucket);

        values = makeArray(values);
        transaction.push(function (cb) {
            //self.db.collection(self.prefix + collName, function (err, collection) {

            // build doc from array values
            var doc = {};
            values.forEach(function (value) {
                doc[value] = true;
            });
            updateParams.$unset = doc;

            console.log("remove: update: ", self.prefix + collName, updateParams);

            // update document
            self.db.update(self.prefix + collName, updateParams, function (err) {
                console.log("remove.update.done: ", err, arguments);
                if (err instanceof Error)
                    return cb(err);
                
                console.log("remove: running callback");
                cb(undefined);
            });
        });
    },
    sync: function(cb) {
        var self = this;
        console.log("We're going to sync...");
        this.db.find('resources', {}, function(err, cursor, length) {
            if (err) {
                console.error(err);
                //cb(true, err);
                return;
            }

            console.log("len:", length);

            var count = 0;
            var result = [];

            while (cursor.next()) {
                count++;
                result.push(cursor.object());
            }

            //cb(null, result);
            self.db.sync(cb);
        });
    }
};

function encodeText(text) {
    if (typeof text === 'string' || text instanceof String) {
        text = encodeURIComponent(text);
        text = text.replace(/\./, '%2E');
    }
    return text;
}

function decodeText(text) {
    if (typeof text === 'string' || text instanceof String) {
        text = decodeURIComponent(text);
    }
    return text;
}

function encodeAll(arr) {
    if (Array.isArray(arr)) {
        var ret = [];
        arr.forEach(function (aval) {
            ret.push(encodeText(aval));
        });
        return ret;
    } else {
        return arr;
    }
}

function decodeAll(arr) {
    if (Array.isArray(arr)) {
        var ret = [];
        arr.forEach(function (aval) {
            ret.push(decodeText(aval));
        });
        return ret;
    } else {
        return arr;
    }
}

function fixKeys(doc) {
    if (doc) {
        var ret = {};
        for (var key in doc) {
            if (doc.hasOwnProperty(key)) {
                ret[decodeText(key)] = doc[key];
            }
        }
        return ret;
    } else {
        return doc;
    }
}

function fixAllKeys(docs) {
    if (docs && docs.length) {
        var ret = [];
        docs.forEach(function (adoc) {
            ret.push(fixKeys(adoc));
        });
        return ret;
    } else {
        return docs;
    }
}

function makeArray(arr) {
    return Array.isArray(arr) ? encodeAll(arr) : [encodeText(arr)];
}

exports = module.exports = EJDBBackend;