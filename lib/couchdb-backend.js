/**
  CouchDB Backend.
  Implementation of the storage backend using CouchDB
 */

var contract = require('./contract');
var async = require('async');
var _ = require('underscore');

function CouchDBBackend(db, prefix){
	this.db = db;
	this.prefix = typeof prefix !== 'undefined' ? prefix : '';
}

CouchDBBackend.prototype = {
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
			this.db.collections(function(err, collections) {
				if (err instanceof Error) return cb(err);
				async.forEach(collections,function(coll,innercb){
					coll.drop(function(){innercb()}); // ignores errors
				},cb);
			});
		},

		/**
     Gets the contents at the bucket's key.
		 */
		get : function(bucket, key, cb){
			contract(arguments)
			.params('string', 'string', 'function')
			.end();
			this.db.get(this.prefix + bucket,function(err,doc){
				if(err) {console.log(err); return cb(undefined, []);} // not found

				if(! _.isObject(doc[key]) ) return cb(undefined,[]);
				cb(undefined,doc[key]);
			});
		},

		/**
    Returns the union of the values in the given keys.
		 */
		union : function(bucket, keys, cb){
			contract(arguments)
			.params('string', 'array', 'function')
			.end();

			this.db.get(this.prefix + bucket,function(err,doc){
				if(err) {return cb(undefined, []);} // not found
				var keyArrays = [];
				for(i in keys) {
					if(doc[keys[i]] && doc[keys[i]].length)
						doc[keys[i]].forEach(function(idx){
							keyArrays.push(idx);
						});
				}
				cb(undefined, _.union(keyArrays));
			});
		},

		/**
    Adds values to a given key inside a bucket.
		 */
		add : function(transaction, bucket, key, values){
			contract(arguments)
			.params('array', 'string', 'string','string|array')
			.end();

			if(key[0]=="_") throw new Error("Key name '"+key+"' is not allowed.");
			var self=this;

			transaction.push(function(cb){
				values = makeArray(values);
				self.db.get(self.prefix + bucket, function(err, doc) {
					if(err) 
						var doc = {};

					var modify=true;

					if(key instanceof Array)
						for(i in key) {
							if(!doc[key[i]]){
								doc[key[i]] = values;
							}else{
								doc[key[i]] = _.union(values, doc[key[i]]);
							}
						}	
					else {
						var len = 0;
						if(doc[key])
							len = doc[key].length;

						if(!doc[key]){
							doc[key] = values;
						}else{
							doc[key] = _.union(values, doc[key]);
						}

						if(len == doc[key].length)
							modify=false; // no modification
					}

					if(modify) { //need update
						self.db.save(self.prefix + bucket, doc, function(err, res){
							if(err) { console.log(err); console.log(doc); console.log(key+":"+values); return cb(err); }
							cb(undefined);
						});
					} else {
						cb(undefined);
					}
				});
			});
		},

		/**
     Delete the given key(s) at the bucket
		 */
		del : function(transaction, bucket, keys){
			contract(arguments)
			.params('array', 'string', 'string|array')
			.end();
			keys = makeArray(keys);
			var self= this;
			transaction.push(function(cb){
				self.db.get(self.prefix + bucket,function(err,doc){
					var find=false;
					if(err) {return cb(err);}
					if(doc){
						for(var i=0, len=keys.length;i<len;i++){
							if(doc[keys[i]]) {
								delete doc[keys[i]];
								find=true;
							}
						}
					}

					if(find) { //need update
						self.db.save(self.prefix + bucket, doc, function(err, res){
							if(err) { console.log(err); console.log(doc); console.log(keys); return cb(err); }
							cb(undefined);
						});
					} else {
						cb(undefined);
					}
				});
			});
		},

		/**
    Removes values from a given key inside a bucket.
		 */
		remove : function(transaction, bucket, key, values){
			contract(arguments)
			.params('array', 'string', 'string','string|array')
			.end();

			var self=this;
			values = makeArray(values);
			transaction.push(function(cb){
				self.db.get(self.prefix + bucket,function(err,doc){
					if(err) return cb(err);

					// build doc from array values
					var old;
					var find = false;
					if(doc && (old = doc[key])){
						doc[key] = _.difference(old, values);
						if(old.length != doc[key].length)
							find = true;
					}

					// update document
					if(find) {
						self.db.save(self.prefix + bucket, doc, function(err, res){
							if(err) { console.log(err); console.log(doc); console.log(key+":"+values); return cb(err); }
							cb(undefined);
						});
					} else {
						cb(undefined);
					}
				});
			});
		}
}

function makeArray(arr){
	return Array.isArray(arr) ? arr : [arr];
}

exports = module.exports = CouchDBBackend;
