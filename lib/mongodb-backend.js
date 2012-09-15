/**
	MongoDB Backend.
  Implementation of the storage backend using MongoDB
*/

var mongodb = require('mongodb'); 
var contract = require('./contract');
var async = require('async');
var _ = require('underscore');

function MongoDBBackend(client, collectionName){
  this.client = client;
  this.collection = new mongodb.Collection(client, collectionName||"acl");
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
    
    // Execute transactions serially
    async.series(transaction,function(err,results){
      cb(err||undefined);
    });
  },
  
  /**
    Cleans the whole storage.
  */
  clean : function(cb){
    contract(arguments).params('function').end();
    this.collection.remove(null, {safe:true}, function(err){
      cb(err||undefined);
    });
  },
  
  /**
     Gets the contents at the bucket's key.
  */
  get : function(bucket, key, cb){
		contract(arguments)
	      .params('string', 'string', 'function')
	      .end();
    
    this.collection.findOne(
      {bucket:bucket,key:key}, 
      function(err, doc){
        if(err) return cb(err);
        if(!doc) return cb(undefined,[]);
        cb(null,doc.value||[]);
      }
    );
  },

	/**
		Returns the union of the values in the given keys.
	*/
  union : function(bucket, keys, cb){
    contract(arguments)
  	  .params('string', 'array', 'function')
  	  .end();
      
    this.collection.find(
      {bucket: bucket, key: { $in: keys }}, 
      {fields:{value:1}}
    ).toArray(function(err,docs){ 
      if(err) return cb(err);
      if( ! docs.length ) return cb(undefined, []);
      var keyArrays = [];
      docs.forEach(function(doc){
        keyArrays.push.apply(keyArrays, doc.value);
      });
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
        
    values = makeArray(values);
    var collection = this.collection;
    transaction.push(function(cb){
      collection.findOne({bucket:bucket,key:key},function(err,doc){
        if (!doc) {
          collection.insert(
            {bucket:bucket,key:key,value:values},
            {safe:true},
            function(err){cb(err||undefined);}
          ); 
        } else {
          collection.update(
            {bucket:bucket,key:key},
            {$set:{value:_.union(doc.value,values)}},
            {safe:true},
            function(err){cb(err||undefined);}
          );
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
    var collection = this.collection;
    transaction.push(function(cb){
      collection.remove(
        {bucket:bucket,key:{$in:keys}}, 
        {safe:true}, 
        function(err){cb(err||undefined);}
      );
    })
  },
  
	/**
		Removes values from a given key inside a bucket.
	*/
	remove : function(transaction, bucket, key, values){
		contract(arguments)
	      .params('array', 'string', 'string','string|array')
        .end();
        
    var collection = this.collection;
    values = makeArray(values);
    transaction.push(function(cb){
      collection.findOne({bucket:bucket,key:key}, function(err, doc){
        if(err) return cb(err);
        if(!doc) return cb(undefined,[]);
        collection.update(
          {bucket:bucket,key:key}, 
          {$set:{value: _.difference(doc.value, values) }},
          {safe:true},
          function(err){cb(err||undefined);}
        );
      });
    });
	},
}

function makeArray(arr){
  return Array.isArray(arr) ? arr : [arr];
}

exports = module.exports = MongoDBBackend;