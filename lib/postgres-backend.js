/**
	Postgres Backend.
	Implementation of the storage backend using Knex.js
*/

var contract = require('./contract');
var async = require('async');
_ = require('lodash');


function PostgresDBBackend(db, prefix){
	this.db = db;
	this.prefix = typeof prefix !== 'undefined' ? prefix : '';
}

PostgresDBBackend.prototype = {
	/**  
		 Begins a transaction.
	*/
	begin : function(){
		// returns a transaction object
		return [];
	},
	
	/**
		 Ends a transaction (and executes it)
	*/
	end : function(transaction, cb){
		contract(arguments)
			.params('array', 'function')
			.end()
		;
		
		// Execute transaction
		async.series(transaction,function(err){
			cb(err instanceof Error? err : undefined);
		});
	},
	
	/**
		Cleans the whole storage.
	*/
	clean : function(cb){
		contract(arguments)
			.params('function')
			.end()
		;
		cb(undefined);
	},
	
	/**
		 Gets the contents at the bucket's key.
	*/
	get : function(bucket, key, cb){
		contract(arguments)
			.params('string', 'string|number', 'function')
			.end()
		;
		
		var table = '';
		if (bucket.indexOf('allows') != -1) {
			table = this.prefix + 'permissions';
			this.db
				.select('key', 'value')
				.from(table)
				.where({'key': bucket})
				.then(function(result) {
					if (result.length) {
						cb(undefined, (result[0].value[key] ? result[0].value[key] : []));
					} else {
						cb(undefined, []);
					}
				})
			;
		} else {
			table = this.prefix + bucket;
			this.db
				.select('key', 'value')
				.from(table)
				.where({'key': key})
				.then(function(result) {
					cb(undefined, (result.length ? result[0].value : []));
				})
			;
		}
	},
	
	/**
		Returns the union of the values in the given keys.
	*/
	union : function(bucket, keys, cb){
		contract(arguments)
			.params('string', 'array', 'function')
			.end()
		;
		
		var table = '';
		if (bucket.indexOf('allows') != -1) {
			table = this.prefix + 'permissions';
			this.db
				.select('key', 'value')
				.from(table)
				.where({'key': bucket})
				.then(function(result) {
					if (result.length) {
						var keyArrays = [];
						_.each(keys, function(value) {
							keyArrays.push.apply(keyArrays, result[0].value[value]);
						});
						cb(undefined, keyArrays);
					} else {
						cb(undefined, []);
					}
					
				})
			;
		} else {
			table = this.prefix + bucket;
			this.db
				.select('key', 'value')
				.from(table)
				.whereIn('key', keys)
				.then(function(result) {
					if (result.length) {
						var keyArrays = [];
						_.each(keys, function() {
							keyArrays.push.apply(keyArrays, result[0].value);
						});
						cb(undefined, keyArrays);
					} else {
						cb(undefined, []);
					}
				})
			;
		}
	},
	
	/**
		Adds values to a given key inside a table.
	*/
	add : function(transaction, bucket, key, values){
		contract(arguments)
			.params('array', 'string', 'string|number','string|array|number')
			.end()
		;
		
		var self = this;
		var table = '';
		values = Array.isArray(values) ? values : [values]; // we always want to have an array for values
		
		transaction.push(function(cb){
			
			if (bucket.indexOf('allows') != -1) {
				table = self.prefix + 'permissions';
				self.db
					.select('key', 'value')
					.from(table)
					.where({'key': bucket})
					.then(function(result) {
						var json = {};
						
						if (result.length === 0) {
							
							// if no results found do a fresh insert
							json[key] = values;
							return self.db(table)
								.insert({key: bucket, value: json})
							;
						} else {
							
							// if we have found the key in the table then lets refresh the data
							if (_.has(result[0].value, key)) {
								result[0].value[key] = _.union(values, result[0].value[key]);
							} else {
								result[0].value[key] = values;
							}
							
							return self.db(table)
								.where('key', bucket)
								.update({key: bucket, value: result[0].value})
							;
						}
					})
					.then(function() {
						cb(undefined);
					})
				;
			} else {
				table = self.prefix + bucket;
				self.db
					.select('key', 'value')
					.from(table)
					.where({'key': key})
					.then(function(result) {
						
						if (result.length === 0) {
							
							// if no results found do a fresh insert
							return self.db(table)
								.insert({key: key, value: values})
							;
						} else {
							
							// if we have found the key in the table then lets refresh the data
							return self.db(table)
								.where('key', key)
								.update({value: _.union(values, result[0].value)})
							;
						}
					})
					.then(function() {
						cb(undefined);
					})
				;
			}
		});
	},
	
	/**
		 Delete the given key(s) at the bucket
	*/
	del : function(transaction, bucket, keys){
		contract(arguments)
			.params('array', 'string', 'string|array')
			.end()
		;
		
		var self = this;
		var table = '';
		keys = Array.isArray(keys) ? keys : [keys]; // we always want to have an array for keys
		
		transaction.push(function(cb){
			
			if (bucket.indexOf('allows') != -1) {
				table = self.prefix + 'permissions';
				self.db
					.select('key', 'value')
					.from(table)
					.where({'key': bucket})
					.then(function(result) {
						
						if (result.length === 0) {
							
						} else {
							_.each(keys, function(value) {
								result[0].value = _.omit(result[0].value, value);
							});
							
							if (_.isEmpty(result[0].value)) {
								// if no more roles stored for a resource the remove the resource
								return self.db(table)
									.where('key', bucket)
									.del()
								;
							} else {
								return self.db(table)
									.where('key', bucket)
									.update({value: result[0].value})
								;
							}
						}
					})
					.then(function() {
						cb(undefined);
					})
				;
			} else {
				// needs code
			}
		});
	},
	
	/**
		Removes values from a given key inside a bucket.
	*/
	remove : function(transaction, bucket, key, values){
		contract(arguments)
			.params('array', 'string', 'string|number','string|array')
			.end()
		;
		
		var self = this;
		var table = '';
		values = Array.isArray(values) ? values : [values]; // we always want to have an array for values
		
		transaction.push(function(cb){
			
			if (bucket.indexOf('allows') != -1) {
				table = self.prefix + 'permissions';
				self.db
					.select('key', 'value')
					.from(table)
					.where({'key': bucket})
					.then(function(result) {
						if(result.length === 0) {return;}
						
						// update the permissions for the role by removing what was requested
						_.each(values, function(value) {
							result[0].value[key] = _.without(result[0].value[key], value);
						});
						
						//  if no more permissions in the role then remove the role
						if (!result[0].value[key].length) {
							result[0].value = _.omit(result[0].value, key);
						}
						
						return self.db(table)
							.where('key', bucket)
							.update({value: result[0].value})
						;
					})
					.then(function(result) {
						cb(undefined);
					})
				;
			} else {
				table = self.prefix + bucket;
				self.db
					.select('key', 'value')
					.from(table)
					.where({'key': key})
					.then(function(result) {
						if(result.length === 0) {return;}
						
						var resultValues = result[0].value;
						// if we have found the key in the table then lets remove the values from it
						_.each(values, function(value) {
							resultValues = _.without(resultValues, value);
						});
						return self.db(table)
							.where('key', key)
							.update({value: resultValues})
						;
					})
					.then(function(result) {
						cb(undefined);
					})
				;
			}
		});
	}
}

exports = module.exports = PostgresDBBackend;
