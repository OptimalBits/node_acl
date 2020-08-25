/**
	Redis Backend.

  Implementation of the storage backend using Redis
*/
"use strict";

var contract = require("./contract");

function noop() {}

function RedisBackend({ redis, prefix }) {
    this.redis = redis;
    this.prefix = prefix || "acl_";
}

RedisBackend.prototype = {
    close(cb) {
        this.redis.end();
        cb();
    },

    /**
     Begins a transaction
  */
    begin() {
        return this.redis.multi();
    },

    /**
     Ends a transaction (and executes it)
  */
    end(transaction, cb) {
        contract(arguments).params("object", "function").end();
        transaction.exec(function () {
            cb();
        });
    },

    /**
    Cleans the whole storage.
  */
    clean(cb) {
        contract(arguments).params("function").end();
        this.redis.keys(this.prefix + "*", (err, keys) => {
            if (keys.length) {
                this.redis.del(keys, function () {
                    cb();
                });
            } else {
                cb();
            }
        });
    },

    /**
     Gets the contents at the bucket's key.
  */
    get(bucket, key, cb) {
        contract(arguments).params("string", "string|number", "function").end();

        key = this.bucketKey(bucket, key);

        this.redis.smembers(key, cb);
    },

    /**
    Gets an object mapping each passed bucket to the union of the specified keys inside that bucket.
  */
    unions(buckets, keys, cb) {
        contract(arguments).params("array", "array", "function").end();

        var redisKeys = {};
        var batch = this.redis.batch();

        for (const bucket of buckets) {
            redisKeys[bucket] = this.bucketKey(bucket, keys);
            batch.sunion(redisKeys[bucket], noop);
        }

        batch.exec(function (err, replies) {
            if (!Array.isArray(replies)) {
                return {};
            }

            var result = {};
            for (let index = 0; index < replies.length; index++) {
                let reply = replies[index];
                if (reply instanceof Error) cb(reply);

                result[buckets[index]] = reply;
            }
            cb(err, result);
        });
    },

    /**
		Returns the union of the values in the given keys.
	*/
    union(bucket, keys, cb) {
        contract(arguments).params("string", "array", "function").end();

        keys = this.bucketKey(bucket, keys);
        this.redis.sunion(keys, cb);
    },

    /**
		Adds values to a given key inside a bucket.
	*/
    add(transaction, bucket, key, values) {
        contract(arguments).params("object", "string", "string|number", "string|array|number").end();

        key = this.bucketKey(bucket, key);

        if (Array.isArray(values)) {
            for (const value of values) {
                transaction.sadd(key, value);
            }
        } else {
            transaction.sadd(key, values);
        }
    },

    /**
     Delete the given key(s) at the bucket
  */
    del(transaction, bucket, keys) {
        contract(arguments).params("object", "string", "string|array").end();

        keys = Array.isArray(keys) ? keys : [keys];

        keys = keys.map((key) => this.bucketKey(bucket, key));

        transaction.del(keys);
    },

    /**
		Removes values from a given key inside a bucket.
	*/
    remove(transaction, bucket, key, values) {
        contract(arguments).params("object", "string", "string|number", "string|array|number").end();

        key = this.bucketKey(bucket, key);

        if (Array.isArray(values)) {
            for (const value of values) {
                transaction.srem(key, value);
            }
        } else {
            transaction.srem(key, values);
        }
    },

    //
    // Private methods
    //

    bucketKey(bucket, keys) {
        if (Array.isArray(keys)) {
            return keys.map((key) => this.prefix + "_" + bucket + "@" + key);
        } else {
            return this.prefix + "_" + bucket + "@" + keys;
        }
    },
};

exports = module.exports = RedisBackend;
