/**
	MongoDB Backend.
  Implementation of the storage backend using MongoDB
*/

var contract = require('./contract');
var async = require('async');
var _ = require('underscore');

function MongoDBBackend(db, prefix){
  this.db = db;
  this.prefix = prefix || "acl";
}

MongoDBBackend.prototype = {
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
    console.log("Committing transaction");
    async.series(transaction,function(err,results){
      if(err) console.log("!!! Transaction aborted");
      else console.log("==>Transaction committed");
      cb(err);
    });      
  },
  
  /**
    Cleans the whole storage.
  */
  clean : function(cb){
    contract(arguments).params('function').end();
    this.db.collections(function(err, collections) {
      if(err) return cb(err);
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
    var self=this;
    this.db.collection(bucket,{safe:true},function(err,collection){
      if(err) return cb(err);
      self.collection.findOne({key:key},function(err, doc){
        if(err) return cb(err);
        if(!doc) return cb(undefined,[]);
        cb(null,doc.value||[]);
      });
    });
  },

	/**
		Returns the union of the values in the given keys.
	*/
  union : function(bucket, keys, cb){
    contract(arguments)
  	  .params('string', 'array', 'function')
  	  .end();
      
    this.db.collection(bucket, {safe:true},function(err,collection){
      if(err) return cb(err);
      collection.find({key: { $in: keys }}).toArray(function(err,docs){ 
        if(err) return cb(err);
        if( ! docs.length ) return cb(undefined, []);
        var keyArrays = [];
        docs.forEach(function(doc){
          keyArrays.push.apply(keyArrays, doc.value);
        });
        cb(undefined, _.union(keyArrays));
      });
    });
	},
  
  /**
		Adds values to a given key inside a bucket.
	*/
	add : function(transaction, bucket, key, values){
		contract(arguments)
	      .params('array', 'string', 'string','string|array')
        .end();
    
    var self=this;  
    transaction.push(function(cb){
      values = makeArray(values);
      console.log("Adding %s to %s/%s",values,bucket,key);
      self.db.collection(bucket,{safe:true},function(err,collection){
        if(err) return cb(err);
        // get array content
        collection.findAndModify(
          {key:key},[],
          {safe:true,upsert:true,"new":true},
          {},
          function(err,doc){
            if(err) return cb(err);
            var oldValue = doc ? doc.value : [];
            var newValue = _.union(oldValue,values);
            // set new array content in atomic operation
            collection.findAndModify(
              {key:key,value:oldValue},[],
              {$set:{value:newValue}},
              {safe:true,"new":true},
              function(err,doc){
                if(err) return cb(err);
                if(!doc) {
                  // value has changed between first read, try again
                  console.log("Document has changed, retrying");
                  return self.add(transaction, bucket, key, values);
                }
                console.log("==>Added %s to %s/%s: %s -> %s",values,bucket,key,oldValue,newValue);
                cb();
              }
            );
          });
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
      self.db.collection(bucket,{safe:true},function(err,collection){
        if(err) return cb(err);
        collection.remove({key:{$in:keys}},{safe:true},cb); 
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
    console.log("Removing %s from %s/%s...",values, bucket, key );
    transaction.push(function(cb){
      self.db.collection(bucket,{safe:true},function(err,collection){
        // find original array value
        collection.findAndModify(
          {key:key},[],
          {safe:true,upsert:true,"new":true},
          function(err, doc){
            if(err) return cb(err);
            var oldValue = doc.value; 
            var newValue = _.difference(oldValue||[], values);
            // try to atomically update the array
            collection.findAndModify(
              {key:key,value:oldValue}, 
              {$set:{value: newValue }},
              {safe:true,"new":true},
              function(err,doc){
                if(err) return cb(err);
                if(!doc) {
                  // value has changed between first read, try again
                  console.log("Document has changed, retrying");
                  return self.remove(transaction, bucket, key, values);
                }
                console.log("   Removed %s from %s/%s Result:%s -> %s", values,bucket,key, oldValue, doc.value);
                cb(undefined);
              }
            );
          }
        );
      });
    });
	},
  
  createBucket : function(transaction,bucket) {
    var self=this;
    transaction.push(function(cb){
      self.db.createCollection(bucket,{safe:true},cb);
    });
  }
  
  
}

function makeArray(arr){
  return Array.isArray(arr) ? arr : [arr];
}

exports = module.exports = MongoDBBackend;