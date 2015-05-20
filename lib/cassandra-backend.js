/**
  Cassandra Backend.
  Implementation of the storage backend using Cassandra

  Attention: The specified keyspace and table must exist beforehand. The 'create table' query:
    CREATE TABLE [keyspace].[columnfamily] (
      bucketname varchar,
      key varchar,
      values set<varchar>,
      PRIMARY KEY ((bucketname, key))
    )
*/
"use strict";

var contract = require('./contract');
var async = require('async');
var _ = require('lodash');

function CassandraBackend(client, keyspace, columnfamily){
  this.client = client;
  var keyspaceWithTableName = keyspace + "." + columnfamily;
  this.queries = {
    clean: "TRUNCATE " + keyspaceWithTableName,
    get: "SELECT values FROM " + keyspaceWithTableName + " WHERE bucketname = ? AND key = ?",
    union: "SELECT values FROM " + keyspaceWithTableName + " WHERE bucketname = ? AND key IN ?",
    add: "UPDATE " + keyspaceWithTableName + " SET values = values + ? WHERE bucketname = ? AND key = ?",
    del: "DELETE FROM " + keyspaceWithTableName + " WHERE bucketname = ? AND key IN ?",
    remove: "UPDATE " + keyspaceWithTableName + " SET values = values - ? WHERE bucketname = ? AND key = ?"
  };
}

CassandraBackend.prototype = {
 /**
     Begins a transaction.
  */
  begin : function(){
    // returns a transaction object(just an array of functions will do here.)
    return [];
  },

  /**
     Ends a transaction (and executes it)
  */
  end : function(transaction, cb){
    contract(arguments).params('array', 'function').end();
    async.series(transaction,function(err){
      cb(err instanceof Error? err : undefined);
    });
  },

  /**
    Cleans the whole storage.
  */
  clean : function(cb){
    contract(arguments).params('function').end();
    this.client.execute(this.queries.clean, [], cb);
  },

  /**
     Gets the contents at the bucket's key.
  */
  get: function(bucket, key, cb) {
    contract(arguments)
      .params('string', 'string|number', 'function')
      .end();
    key = encodeText(key);
    this.client.execute(this.queries.get, [bucket, key], {hints: ['varchar', 'varchar']}, function(err, result) {
      if (err) return cb(err);
      if (result.rows.length == 0) return cb(undefined, []);
      result = decodeAll(result.rows[0].values);
      cb(undefined, result);
    });
  },

  /**
    Returns the union of the values in the given keys.
  */
  union: function(bucket, keys, cb) {
    contract(arguments)
      .params('string', 'array', 'function')
      .end();
    keys = encodeAll(keys);
    this.client.execute(this.queries.union, [bucket, keys], {hints: ['varchar', 'set<varchar>']}, function(err, result) {
      if (err) return cb(err);
      if (result.rows.length == 0) return cb(undefined, []);
      result = result.rows.reduce(function(prev, curr) { return prev.concat(decodeAll(curr.values)) }, []);
      cb(undefined, _.union(result));
    });
  },

  /**
    Adds values to a given key inside a bucket.
  */
  add: function(transaction, bucket, key, values) {
    contract(arguments)
      .params('array', 'string', 'string|number', 'string|array|number')
      .end();

    if (key == "key") throw new Error("Key name 'key' is not allowed.");
    key = encodeText(key);
    var self = this;
    transaction.push(function (cb) {
      values = makeArray(values);
      self.client.execute(self.queries.add, [values, bucket, key], {hints: ['set<varchar>', 'varchar', 'varchar']}, function(err) {
        if (err) return cb(err);
        cb(undefined);
      });
    });
  },

  /**
     Delete the given key(s) at the bucket
  */
  del: function(transaction, bucket, keys) {
    contract(arguments)
      .params('array', 'string', 'string|array')
      .end();
    keys = makeArray(keys);
    var self = this;
    transaction.push(function (cb) {
      self.client.execute(self.queries.del, [bucket, keys], {hints: ['varchar', 'set<varchar>']}, function(err) {
        if (err) return cb(err);
        cb(undefined);
      });
    });
  },

  /**
    Removes values from a given key inside a bucket.
  */
  remove: function(transaction, bucket, key, values) {
    contract(arguments)
      .params('array', 'string', 'string|number', 'string|array|number')
      .end();
    key = encodeText(key);
    var self = this;
    values = makeArray(values);
    transaction.push(function (cb) {
      self.client.execute(self.queries.remove, [values, bucket, key], {hints: ['set<varchar>', 'varchar', 'varchar']}, function(err) {
        if (err) return cb(err);
        cb(undefined);
      });
    });
  }
};

function encodeText(text) {
  if (typeof text == 'number' || text instanceof Number) text = text.toString();
  if (typeof text == 'string' || text instanceof String) {
    text = encodeURIComponent(text);
    text = text.replace(/\./, '%2E');
  }
  return text;
}

function decodeText(text) {
  if (typeof text == 'string' || text instanceof String) {
    text = decodeURIComponent(text);
  }
  return text;
}

function encodeAll(arr) {
  if (Array.isArray(arr)) {
    var ret = [];
    arr.forEach(function(aval) {
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
    arr.forEach(function(aval) {
      ret.push(decodeText(aval));
    });
    return ret;
  } else {
    return arr;
  }
}

function makeArray(arr){
  return Array.isArray(arr) ? encodeAll(arr) : [encodeText(arr)];
}

exports = module.exports = CassandraBackend;
