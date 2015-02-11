var Acl = require('../')
  , tests = require('./tests')

describe('MongoDB - Default', function () {
  before(function (done) {
    var self = this
      , mongodb = require('mongodb')

    mongodb.connect('mongodb://localhost:27017/acltest',function(error, db) {
      db.dropDatabase(function () {
        self.backend = new Acl.mongodbBackend(db, "acl")
        done()
      })
    })
  })

  run()
});


describe('MongoDB - useSingle', function () {
  before(function (done) {
    var self = this
      , mongodb = require('mongodb')

    mongodb.connect('mongodb://localhost:27017/acltest',function(error, db) {
      db.dropDatabase(function () {
        self.backend = new Acl.mongodbBackend(db, "acl", true)
        done()
      })
    })
  })

  run()
});

describe('EJDB - useSingle', function () {

  before(function (done) {
    var self = this;
    
    var EJDB = require('ejdb');
    // Init and open DB
    var dbpath = './test';
    var dbname = dbpath+'/acl.db';
    var jb = EJDB.open(dbname, EJDB.DEFAULT_OPEN_MODE);
    
    var EJDBBackend = require('../lib/ejdb-backend.js');
    self.backend = new EJDBBackend(jb);
    done()
  })
  
  after(function() {
    this.backend.sync()
  })

  run()
});

describe('Redis', function () {
  before(function (done) {
    var self = this
      , options = {
          host: '127.0.0.1',
          port: 6379,
          password: null
        }
      , Redis = require('redis')
        
        
    var redis = Redis.createClient(options.port, options.host,  {no_ready_check: true} )

    function start(){
      self.backend = new Acl.redisBackend(redis)
      done()
    }
    
    if (options.password) {
      redis.auth(options.password, start)
    } else {
      start()
    }
  })
  
  run()
})


describe('Memory', function () {
  before(function () {
    var self = this
      self.backend = new Acl.memoryBackend()
  })
  
  run()
})

function run() {
  Object.keys(tests).forEach(function (test) {
    tests[test]()
  })
}