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


describe('Postgres', function () {
  before(function (done) {
    var self = this
      , knex = require('knex')
   
    var db = knex({
      client: 'postgres',
      connection: {
        host: '192.168.59.103',
        port: 5433,
        user: 'blnapi',
        password: 'blnapi',
        database: 'blnapi'
      }
    });
    
    var downSql = 'DROP TABLE IF EXISTS "acl_meta";'+
      'DROP TABLE IF EXISTS "acl_resources";'+
      'DROP TABLE IF EXISTS "acl_parents";'+
      'DROP TABLE IF EXISTS "acl_users";'+
      'DROP TABLE IF EXISTS "acl_permissions";'
    ;
    var upSql = 'CREATE TABLE acl_meta (key TEXT NOT NULL PRIMARY KEY, value TEXT[][] NOT NULL);'+
      'CREATE TABLE acl_resources (key TEXT NOT NULL PRIMARY KEY, value TEXT[][] NOT NULL);'+
      'CREATE TABLE acl_parents (key TEXT NOT NULL PRIMARY KEY, value TEXT[][] NOT NULL);'+
      'CREATE TABLE acl_users (key TEXT NOT NULL PRIMARY KEY, value TEXT[][] NOT NULL);'+
      'CREATE TABLE acl_permissions (key TEXT NOT NULL PRIMARY KEY, value JSON NOT NULL);'
    ;
    
    db.raw(downSql+upSql)
      .then(function(resp) {
        self.backend = new Acl.postgresBackend(db, "acl_");
        done();
      })
    ;
    
  });
  
  run();
});


function run() {
  Object.keys(tests).forEach(function (test) {
    tests[test]()
  })
}