
var vows = require('vows'),
  assert = require('assert'),
  client = require('redis').createClient(6379, '127.0.0.1'),
    Step = require('../lib/step.js'),
     acl = require('../lib/acl.js'),

acl = new acl(client, 'test')

var suite = vows.describe('Access Control Lists')

suite.addBatch({
  'Clean up':{
    topic: function(){acl.clean(this.callback)},
    'cleaned':function(err){
      assert.isUndefined(err)
    }
  }
})

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
      acl.allowEx([{roles:'fumanchu', 
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
      assert.include(permissions, 'blogs')
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
})

suite.export(module)
