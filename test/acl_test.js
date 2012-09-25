
var vows = require('vows'),
  assert = require('assert'),
  Acl = require('../lib/acl.js');

// run tests according to different backends
function testBackend(type, options, cb){
  switch(type)
  {
    case "memory":
      var memoryBackend = require('../lib/memory-backend');
      startTests(new memoryBackend(), cb);
      break;
    
    case "redis":
      var redisBackend = require('../lib/redis-backend');
      var client = require('redis').createClient(
        options.port, options.host,  {no_ready_check: true} );
      var start = function(){
        startTests(new redisBackend(client), cb);
      };
      if (options.password) client.auth(options.password, start);
      else start();
      break;
      
    case "mongodb":
      var mongodb = require('mongodb'); 
      var mongoDBBackend = require('../lib/mongodb-backend');
      mongodb.connect(options,function(error, db) {
        startTests(new mongoDBBackend(db, "acl"), cb);
      });   
      break;
      
    default: throw new Error(type + " is not a valid backend");
  };
}

// export this
exports.testBackend = testBackend;

// start test suite
function startTests (backend, cb){
  
acl = new Acl(backend);

var suite = vows.describe('Access Control Lists');

/**
  Batch for cleaning the keys used for unit testing.
*/
suite.addBatch({
  'Clean up':{
    topic: function(){backend.clean(this.callback)},
    'cleaned':function(err){
      assert.isUndefined(err)
    }
  }
})

/**
  Batch for testing allows

*/
suite.addBatch({
  'Allow guest to view blogs':{
    topic: function(){acl.allow('guest', 'blogs', 'view', this.callback)},
    'no error':function(err){
      assert.isUndefined(err)
    }
  },
  'Allow guest to view forums':{
    topic: function(){acl.allow('guest', 'forums', 'view', this.callback)},
    'no error':function(err){
      assert.isUndefined(err)
    }
  },
  'Allow member to view, edit and delete blogs':{
    topic: function(){acl.allow('member', 'blogs', ['edit','view', 'delete'], this.callback)},
    'no error':function(err){
      assert.isUndefined(err)
    }
  },
  'Add guest role to joed':{
    topic: function(){acl.addUserRoles('joed', 'guest', this.callback)},
    'no error':function(err){
      assert.isUndefined(err)
    }
  },
  'Add member role to jsmith':{
    topic: function(){acl.addUserRoles('jsmith', 'member', this.callback)},
    'no error':function(err){
      assert.isUndefined(err)
    }
  },
  'Add admin role to harry':{
    topic: function(){acl.addUserRoles('harry', 'admin', this.callback)},
    'no error':function(err){
      assert.isUndefined(err)
    }
  },
  'Allow admin to view, add, edit and delete users':{
    topic: function(){acl.allow('admin', 'users', ['add','edit','view','delete'], this.callback)},
    'no error':function(err){
      assert.isUndefined(err)
    }
  },
  'Allow foo to view and edit blogs':{
    topic: function(){acl.allow('foo', 'blogs', ['edit','view'], this.callback)},
    'no error':function(err){
      assert.isUndefined(err)
    }
  },
  'Allow bar to view and delete blogs':{
    topic: function(){acl.allow('bar', 'blogs', ['view','delete'], this.callback)},
    'no error':function(err){
      assert.isUndefined(err)
    }
  },
  'Add foo and bar to baz parents':{
    topic: function(){acl.addRoleParents('baz', ['foo','bar'], this.callback)},
    'no error':function(err){
      assert.isUndefined(err)
    }
  },
  'Add baz role to james':{
    topic: function(){acl.addUserRoles('james', 'baz', this.callback)},
    'no error':function(err){
      assert.isUndefined(err)
    }
  },
  'Allow admin to do anything':{
    topic: function(){acl.allow('admin', ['blogs','forums'], '*', this.callback)},
    'no error':function(err){
      assert.isUndefined(err)
    }
  },
  'Give role fumanchu an array of resources and permissions':{
    topic: function(){
      acl.allow([{roles:'fumanchu', 
                  allows:[
                          {resources:'blogs', permissions:'get'},
                          {resources:['forums','news'], permissions:['get','put','delete']}
                    ]}], this.callback)},
    'no error':function(err){
      assert.isUndefined(err)
    }
  },
  'Add fumanchu role to susanne':{
    topic: function(){acl.addUserRoles('suzanne', 'fumanchu', this.callback)},
    'no error':function(err){
      assert.isUndefined(err)
    }
  },
})

/**
  Batch for testing allowance.

*/
suite.addBatch({
  'Can joed view blogs?':{
    topic: function(){acl.isAllowed('joed', 'blogs', 'view', this.callback)},
    'allowed':function(err, allow){
      assert.isNull(err)
      assert.isTrue(allow)
    }
  },
  'Can joed view forums?':{
    topic: function(){acl.isAllowed('joed', 'forums', 'view', this.callback)},
    'allowed':function(err, allow){
      assert.isNull(err)
      assert.isTrue(allow)
    }
  },
  'Can joed edit forums?':{
    topic: function(){acl.isAllowed('joed', 'forums', 'edit', this.callback)},
    'allowed':function(err, allow){
      assert.isNull(err)
      assert.isFalse(allow)
    }
  },
  'Can jsmith edit forums?':{
    topic: function(){acl.isAllowed('jsmith', 'forums', 'edit', this.callback)},
    'allowed':function(err, allow){
      assert.isNull(err)
      assert.isFalse(allow)
    }
  },
  'Can jsmith edit blogs?':{
    topic: function(){acl.isAllowed('jsmith', 'blogs', 'edit', this.callback)},
    'allowed':function(err, allow){
      assert.isNull(err)
      assert.isTrue(allow)
    }
  },
  'Can jsmith edit, view, and delete blogs?':{
    topic: function(){acl.isAllowed('jsmith', 'blogs', ['edit','view','delete'], this.callback)},
    'allowed':function(err, allow){
      assert.isNull(err)
      assert.isTrue(allow)
    }
  },
  'Can jsmith edit, delete and clone blogs?':{
    topic: function(){acl.isAllowed('jsmith', 'blogs', ['edit','view','clone'], this.callback)},
    'allowed':function(err, allow){
      assert.isNull(err)
      assert.isFalse(allow)
    }
  },
  'Can james edit, delete blogs?':{
    topic: function(){acl.isAllowed('james', 'blogs', ['edit','delete'], this.callback)},
    'allowed':function(err, allow){
      assert.isNull(err)
      assert.isTrue(allow)
    }
  },
  'Can james add blogs?':{
    topic: function(){acl.isAllowed('james', 'blogs', 'add', this.callback)},
    'allowed':function(err, allow){
      assert.isNull(err)
      assert.isFalse(allow)
    }
  },
  'What permissions has james over blogs and forums?':{
    topic: function(){acl.allowedPermissions('james', ['blogs','forums'], this.callback)},
    'permissions':function(err, permissions){
      assert.isNull(err)
      assert.include(permissions, 'blogs')
      assert.include(permissions, 'forums')
      
      assert.include(permissions.blogs, 'edit')
      assert.include(permissions.blogs, 'delete')
      assert.include(permissions.blogs, 'view')
      
      assert.isEmpty(permissions.forums)
    }
  },
  'Can harry add blogs?':{
    topic: function(){acl.isAllowed('harry', 'blogs', 'add', this.callback)},
    'allowed':function(err, allow){
      assert.isNull(err)
      assert.isTrue(allow)
    }
  },
  
  'Can harry delete,add, and view blogs and forums?':{
    topic: function(){acl.isAllowed('harry', 'forums', ['add','delete','view'], this.callback)},
    'allowed':function(err, allow){
      assert.isNull(err)
      assert.isTrue(allow)
    }
  },
  'What permissions has harry over blogs and forums?':{
    topic: function(){acl.allowedPermissions('harry', ['blogs','forums'], this.callback)},
    'permissions':function(err, permissions){
      assert.isNull(err)
      assert.include(permissions, 'blogs')
      assert.include(permissions.blogs, '*')
      assert.include(permissions, 'forums')
      assert.include(permissions.forums, '*')
    }
  },
  'Can suzanne add blogs?':{
    topic: function(){acl.isAllowed('suzanne', 'blogs', 'add', this.callback)},
    'allowed':function(err, allow){
      assert.isNull(err)
      assert.isFalse(allow)
    }
  },
  'Can suzanne get blogs?':{
    topic: function(){acl.isAllowed('suzanne', 'blogs', 'get', this.callback)},
    'allowed':function(err, allow){
      assert.isNull(err)
      assert.isTrue(allow)
    }
  },
  'Can suzanne delete and put news?':{
    topic: function(){acl.isAllowed('suzanne', 'news', ['put','delete'], this.callback)},
    'allowed':function(err, allow){
      assert.isNull(err)
      assert.isTrue(allow)
    }
  },
  'Can suzanne delete and put forums?':{
    topic: function(){acl.isAllowed('suzanne', 'forums', ['put','delete'], this.callback)},
    'allowed':function(err, allow){
      assert.isNull(err)
      assert.isTrue(allow)
    }
  },
  'Can nobody view blogs?':{
    topic: function(){acl.isAllowed('nobody', 'blogs', 'view', this.callback)},
    'allowed':function(err, allow){
      assert.isNull(err)
      assert.isFalse(allow)
    }
  },
  'Can nobody view nothing?':{
    topic: function(){acl.isAllowed('nobody', 'nothing', 'view', this.callback)},
    'allowed':function(err, allow){
      assert.isNull(err)
      assert.isFalse(allow)
    }
  },
})

/**
  Batch for testing whatResources.

*/
suite.addBatch({
  'What resources have "bar" some rights on?':{
    topic: function(){acl.whatResources('bar', this.callback)},
    'resources':function(err, resources){
      assert.isNull(err)
      assert.include(resources, 'blogs')
      assert.include(resources.blogs, 'view')
      assert.include(resources.blogs, 'delete')
    }
  },
  'What resources have "bar" view right on?':{
    topic: function(){acl.whatResources('bar', 'view', this.callback)},
    'resources':function(err, resources){
      assert.isNull(err)
      assert.include(resources, 'blogs')
    }
  },
  'What resources have "fumanchu" some rights on?':{
    topic: function(){acl.whatResources('fumanchu', this.callback)},
    'resources':function(err, resources){
      assert.isNull(err)
      assert.include(resources, 'blogs')
      assert.include(resources.blogs, 'get')
      assert.include(resources, 'forums')
      assert.include(resources.forums, 'delete')
      assert.include(resources.forums, 'get')
      assert.include(resources.forums, 'put')
      assert.include(resources.news, 'delete')
      assert.include(resources.news, 'get')
      assert.include(resources.news, 'put')
    }
  },
  'What resources have "baz" some rights on?':{
    topic: function(){acl.whatResources('baz', this.callback)},
    'resources':function(err, resources){
      assert.isNull(err)
      assert.include(resources, 'blogs')
      assert.include(resources.blogs, 'view')
      assert.include(resources.blogs, 'delete')
      assert.include(resources.blogs, 'edit')
    }
  }
})

/**
  Batch for testing permissions removal.

*/
suite.addBatch({
  'Remove get permissions from resources blogs and forums from role fumanchu':{
    topic: function(){acl.removeAllow('fumanchu', ['blogs','forums'], 'get',this.callback)},
    'resources':function(err){
      assert.isUndefined(err)
    }
  },
  'Remove delete and put permissions from resource news from role fumanchu':{
    topic: function(){acl.removeAllow('fumanchu', 'news', 'delete', this.callback)},
    'resources':function(err){
      assert.isUndefined(err)
    }
  },
  'Remove view permissions from resource blogs from role bar':{
    topic: function(){acl.removeAllow('bar', 'blogs', 'view', this.callback)},
    'resources':function(err){
      assert.isUndefined(err)
    }
  }
})

/**
  Batch for testing permissions have been removed

*/
suite.addBatch({
  'What resources have "fumanchu" some rights on after removed some of them?':{
    topic: function(){acl.whatResources('fumanchu', this.callback)},
    'resources':function(err, resources){
      assert.isNull(err)
      assert.isFalse('blogs' in resources)
      assert.include(resources, 'news')
      assert.include(resources.news, 'get')
      assert.include(resources.news, 'put')
      assert.isFalse('delete' in resources.news)
      assert.include(resources, 'forums')
      assert.include(resources.forums, 'delete')
      assert.include(resources.forums, 'put')
    }
  },
})

/**
  Batch for testing role removal.

*/
suite.addBatch({
  'Remove role fumanchu':{
    topic: function(){acl.removeRole('fumanchu', this.callback)},
    'resources':function(err){
      assert.isUndefined(err)
    }
  },
  'Remove role member':{
    topic: function(){acl.removeRole('member', this.callback)},
    'resources':function(err){
      assert.isUndefined(err)
    }
  },
  'Remove role foo':{
    topic: function(){acl.removeRole('foo', this.callback)},
    'resources':function(err){
      assert.isUndefined(err)
    }
  }
})

/**
  Batch for testing roles have been removed

*/
suite.addBatch({
  'What resources have "fumanchu" some rights on after removed?':{
    topic: function(){acl.whatResources('fumanchu', this.callback)},
    'resources':function(err, resources){
      assert.isNull(err)
      assert.isEmpty(resources)
    }
  },
  'What resources have "member" some rights on after removed?':{
    topic: function(){acl.whatResources('member', this.callback)},
    'resources':function(err, resources){
      assert.isNull(err)
      assert.isEmpty(resources)
    }
  },
  'What permissions has harry over blogs and forums?':{
    topic: function(){acl.allowedPermissions('jsmith', ['blogs','forums'], this.callback)},
    'permissions':function(err, permissions){
      assert.isNull(err)
      assert.isEmpty(permissions.blogs)
      assert.isEmpty(permissions.forums)
    }
  },
  'What permissions has james over blogs?':{
    topic: function(){acl.allowedPermissions('james', 'blogs', this.callback)},
    'permissions':function(err, permissions){
      assert.isNull(err)
      assert.include(permissions, 'blogs')
      assert.include(permissions.blogs, 'delete')
    }
  }
})

/**
  Batch for testing resource removal.

*/
suite.addBatch({
  'Remove resource blogs':{
    topic: function(){acl.removeResource('blogs', this.callback)},
    'resources':function(err){
      assert.isUndefined(err)
    }
  },
  'Remove resource news':{
    topic: function(){acl.removeResource('users', this.callback)},
    'resources':function(err){
      assert.isUndefined(err)
    }
  }
})


/**
  Batch for testing that resources have been removed

*/
suite.addBatch({
  'What permissions has james over blogs?':{
    topic: function(){acl.allowedPermissions('james', 'blogs', this.callback)},
    'permissions':function(err, permissions){
      assert.isNull(err)
      assert.include(permissions, 'blogs')
      assert.isEmpty(permissions.blogs)
    }
  },
  'What resources have "baz" some rights on after removed blogs?':{
    topic: function(){acl.whatResources('baz', this.callback)},
    'resources':function(err, resources){
      assert.isNull(err)
      assert.isEmpty(resources)
    }
  },
  'What resources have "admin" some rights on after removed users resource?':{
    topic: function(){acl.whatResources('admin', this.callback)},
    'resources':function(err, resources){
      assert.isNull(err)
      assert.isFalse('users' in resources)
      assert.isFalse('blogs' in resources)
    }
  },
})

/**
  Batch for testing user roles removal.

*/
suite.addBatch({
  'Remove resource blogs':{
    topic: function(){acl.removeUserRoles('joed','guest', this.callback)},
    'resources':function(err){
      assert.isUndefined(err)
    }
  },
  'Remove resource news':{
    topic: function(){acl.removeUserRoles('harry', 'admin', this.callback)},
    'resources':function(err){
      assert.isUndefined(err)
    }
  }
})

/**
  Batch for testing that roles have been removed from users.

*/
suite.addBatch({
  'What permissions has harry over forums?':{
    topic: function(){acl.allowedPermissions('harry', ['forums','blogs'], this.callback)},
    'permissions':function(err, permissions){
      assert.isNull(err)
      assert.isObject(permissions)
      assert.isEmpty(permissions.forums)
    }
  },
  'What resources have "baz" some rights on after removed blogs?':{
    topic: function(){acl.whatResources('baz', this.callback)},
    'resources':function(err, resources){
      assert.isNull(err)
      assert.isEmpty(resources)
    }
  },
  'What resources have "admin" some rights on after removed users resource?':{
    topic: function(){acl.whatResources('admin', this.callback)},
    'resources':function(err, resources){
      assert.isNull(err)
      assert.isFalse('users' in resources)
      assert.isFalse('blogs' in resources)
    }
  },
})

suite.run({reporter:require('vows/lib/vows/reporters/spec')}, function(results){
  cb(results);
})

}

