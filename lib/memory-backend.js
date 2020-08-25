/**
  Memory Backend.

  In-memory implementation of the storage.
*/
"use strict";

var contract = require("./contract"),
    _ = require("lodash");

function MemoryBackend() {
    this._buckets = {};
}

MemoryBackend.prototype = {
    close(cb) {
        cb();
    },

    /**
     Begins a transaction.
  */
    begin() {
        // returns a transaction object(just an array of functions will do here.)
        return [];
    },

    /**
     Ends a transaction (and executes it)
  */
    end(transaction, cb) {
        contract(arguments).params("array", "function").end();

        // Execute transaction
        for (var i = 0, len = transaction.length; i < len; i++) {
            transaction[i]();
        }
        cb();
    },

    /**
    Cleans the whole storage.
  */
    clean(cb) {
        contract(arguments).params("function").end();
        this._buckets = {};
        cb();
    },

    /**
     Gets the contents at the bucket's key.
  */
    get(bucket, key, cb) {
        contract(arguments).params("string", "string|number", "function").end();

        if (this._buckets[bucket]) {
            cb(null, this._buckets[bucket][key] || []);
        } else {
            cb(null, []);
        }
    },

    /**
     Gets the union of the keys in each of the specified buckets
  */
    unions(buckets, keys, cb) {
        contract(arguments).params("array", "array", "function").end();

        var results = {};

        for (const bucket of buckets) {
            if (this._buckets[bucket]) {
                results[bucket] = _.uniq(_.flatten(_.values(_.pick(this._buckets[bucket], keys))));
            } else {
                results[bucket] = [];
            }
        }

        cb(null, results);
    },

    /**
    Returns the union of the values in the given keys.
  */
    union(bucket, keys, cb) {
        contract(arguments).params("string", "array", "function").end();

        var match;
        var re;
        if (!this._buckets[bucket]) {
            Object.keys(this._buckets).some(function (b) {
                re = new RegExp("^" + b + "$");
                match = re.test(bucket);
                if (match) bucket = b;
                return match;
            });
        }

        if (this._buckets[bucket]) {
            var keyArrays = [];
            for (var i = 0, len = keys.length; i < len; i++) {
                if (this._buckets[bucket][keys[i]]) {
                    keyArrays.push.apply(keyArrays, this._buckets[bucket][keys[i]]);
                }
            }
            cb(undefined, _.union(keyArrays));
        } else {
            cb(undefined, []);
        }
    },

    /**
    Adds values to a given key inside a bucket.
  */
    add(transaction, bucket, key, values) {
        contract(arguments).params("array", "string", "string|number", "string|array|number").end();

        values = makeArray(values);

        transaction.push(() => {
            if (!this._buckets[bucket]) {
                this._buckets[bucket] = {};
            }
            if (!this._buckets[bucket][key]) {
                this._buckets[bucket][key] = values;
            } else {
                this._buckets[bucket][key] = _.union(values, this._buckets[bucket][key]);
            }
        });
    },

    /**
     Delete the given key(s) at the bucket
  */
    del(transaction, bucket, keys) {
        contract(arguments).params("array", "string", "string|array").end();

        keys = makeArray(keys);

        transaction.push(() => {
            if (this._buckets[bucket]) {
                for (var i = 0, len = keys.length; i < len; i++) {
                    delete this._buckets[bucket][keys[i]];
                }
            }
        });
    },

    /**
    Removes values from a given key inside a bucket.
  */
    remove(transaction, bucket, key, values) {
        contract(arguments).params("array", "string", "string|number", "string|array|number").end();

        values = makeArray(values);
        transaction.push(() => {
            var old;
            if (this._buckets[bucket] && (old = this._buckets[bucket][key])) {
                this._buckets[bucket][key] = _.difference(old, values);
            }
        });
    },
};

function makeArray(arr) {
    return Array.isArray(arr) ? arr : [arr];
}

exports = module.exports = MemoryBackend;
