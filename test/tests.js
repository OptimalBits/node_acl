var Acl = require('../')
  , assert = require('chai').assert

exports.Allows = function () {
  describe('allow', function () {
    it('guest to view blogs', function (done) {
      var acl = new Acl(this.backend)

      acl.allow('guest', 'blogs', 'view', function (err) {
        assert(!err)
        done()
      })
    })
    
    it('guest to view forums', function (done) {
      var acl = new Acl(this.backend)

      acl.allow('guest', 'forums', 'view', function (err) {
        assert(!err)
        done()
      })
    })
    
    it('member to view/edit/delete blogs', function (done) {
      var acl = new Acl(this.backend)

      acl.allow('member', 'blogs', ['edit','view', 'delete'], function (err) {
        assert(!err)
        done()
      })
    })
  })
  
  describe('Add user roles', function () {
    it('joed => guest, jsmith => member, harry => admin', function (done) {
      var acl = new Acl(this.backend)
  
      acl.addUserRoles('joed', 'guest', function (err) {
        assert(!err)
        
        acl.addUserRoles('jsmith', 'member', function (err) {
          assert(!err)
          
          acl.addUserRoles('harry', 'admin', function (err) {
            assert(!err)
            done()
          })
        })
      })
    })
  })

  describe('allow', function () {
    it('admin view/add/edit/delete users', function (done) {
      var acl = new Acl(this.backend)

      acl.allow('admin', 'users', ['add','edit','view','delete'], function (err) {
        assert(!err)
        done();
      })
    })
    
    it('foo view/edit blogs', function (done) {
      var acl = new Acl(this.backend)

      acl.allow('foo', 'blogs', ['edit','view'], function (err) {
        assert(!err)
        done()
      })
    })

    it('bar to view/delete blogs', function (done) {
      var acl = new Acl(this.backend)

      acl.allow('bar', 'blogs', ['view','delete'], function (err) {
        assert(!err)
        done()
      })
    })
  })
  
  describe('add role parents', function () {
    it('add them', function (done) {
      var acl = new Acl(this.backend)
      
      acl.addRoleParents('baz', ['foo','bar'], function (err) {
        assert(!err)
        done()
      })
    })
  })

  describe('add user roles', function () {
    it('add them', function (done) {
      var acl = new Acl(this.backend)
      
      acl.addRoleParents('james', 'baz', function (err) {
        assert(!err)
        done()
      })
    })
  })
  
  describe('add user roles', function () {
    it('add them', function (done) {
      var acl = new Acl(this.backend)
      
      acl.addRoleParents('james', 'baz', function (err) {
        assert(!err)
        done()
      })
    })
  })

  describe('allow admin to do anything', function () {
    it('add them', function (done) {
      var acl = new Acl(this.backend)

      acl.allow('admin', ['blogs', 'forums'], '*', function (err) {
        assert(!err)
        done()
      })
    })
  })
  
  describe('Arguments in one array', function () {
    it('give role fumanchu an array of resources and permissions', function (done) {
      var acl = new Acl(this.backend)

      acl.allow(
        [
          {
            roles:'fumanchu',
            allows:[
              {resources:'blogs', permissions:'get'},
              {resources:['forums','news'], permissions:['get','put','delete']}
            ]
          }
        ],
        function (err) {
          assert(!err)
          done()
        }
      )
    })
  })
  
  describe('Add fumanchu role to suzanne', function () {
    it('do it', function (done) {
      var acl = new Acl(this.backend)
      acl.addUserRoles('suzanne', 'fumanchu', function (err) {
        assert(!err)
        done()      
      })
    })
  })
}





exports.Allowance = function () {
  describe('Allowance queries', function () {
    describe('isAllowed', function () {

      it('Can joed view blogs?', function (done) {
        var acl = new Acl(this.backend)

        acl.isAllowed('joed', 'blogs', 'view', function (err, allow) {
          assert(!err)
          assert(allow)
          done()
        })
      })

      it('Can joed view forums?', function (done) {
        var acl = new Acl(this.backend)

        acl.isAllowed('joed', 'forums', 'view', function (err, allow) {
          assert(!err)
          assert(allow)
          done()
        })
      })

      it('Can joed edit forums?', function (done) {
        var acl = new Acl(this.backend)

        acl.isAllowed('joed', 'forums', 'edit', function (err, allow) {
          assert(!err)
          assert(!allow)
          done()
        })
      })

      it('Can jsmith edit forums?', function (done) {
        var acl = new Acl(this.backend)

        acl.isAllowed('jsmith', 'forums', 'edit', function (err, allow) {
          assert(!err)
          assert(!allow)
          done()
        })
      })

      it('Can jsmith edit blogs?', function (done) {
        var acl = new Acl(this.backend)

        acl.isAllowed('jsmith', 'blogs', 'edit', function (err, allow) {
          assert(!err)
          assert(allow)
          done()
        })
      })

      it('Can jsmith edit, delete and clone blogs?', function (done) {
        var acl = new Acl(this.backend)

        acl.isAllowed('jsmith', 'blogs', ['edit','view','clone'], function (err, allow) {
          assert(!err)
          assert(!allow)
          done()
        })
      })

      it('Can jsmith edit, delete blogs?', function (done) {
        var acl = new Acl(this.backend)

        acl.isAllowed('jsmith', 'blogs', ['edit', 'clone'], function (err, allow) {
          assert(!err)
          assert(!allow)
          done()
        })
      })

      it('Can james add blogs?', function (done) {
        var acl = new Acl(this.backend)

        acl.isAllowed('james', 'blogs', 'add', function (err, allow) {
          assert(!err)
          assert(!allow)
          done()
        })
      })
      
      it('Can suzanne add blogs?', function (done) {
        var acl = new Acl(this.backend)

        acl.isAllowed('suzanne', 'blogs', 'add', function (err, allow) {
          assert(!err)
          assert(!allow)
          done()
        })
      })

      it('Can suzanne get blogs?', function (done) {
        var acl = new Acl(this.backend)

        acl.isAllowed('suzanne', 'blogs', 'get', function (err, allow) {
          assert(!err)
          assert(allow)
          done()
        })
      })

      it('Can suzanne delete and put news?', function (done) {
        var acl = new Acl(this.backend)

        acl.isAllowed('suzanne', 'news', ['put','delete'], function (err, allow) {
          assert(!err)
          assert(allow)
          done()
        })
      })
      
      it('Can suzanne delete and put forums?', function (done) {
        var acl = new Acl(this.backend)

        acl.isAllowed('suzanne', 'forums', ['put','delete'], function (err, allow) {
          assert(!err)
          assert(allow)
          done()
        })
      })
      
      it('Can nobody view news?', function (done) {
        var acl = new Acl(this.backend)

        acl.isAllowed('nobody', 'blogs', 'view', function (err, allow) {
          assert(!err)
          assert(!allow)
          done()
        })
      })
      
      it('Can nobody view nothing?', function (done) {
        var acl = new Acl(this.backend)

        acl.isAllowed('nobody', 'nothing', 'view', function (err, allow) {
          assert(!err)
          assert(!allow)
          done()
        })
      })
    })
    
    describe('allowedPermissions', function () {
      it('What permissions has james over blogs and forums?', function (done) {
        var acl = new Acl(this.backend)
        acl.allowedPermissions('james', ['blogs','forums'], function (err, permissions) {
          assert(err === null)

          assert.include(permissions.blogs, 'edit')
          assert.include(permissions.blogs, 'delete')
          assert.include(permissions.blogs, 'view')

          assert(permissions.forums.length === 0)
          
          done()
        })
      })
    })
  })
}




exports.WhatResources = function () {
  describe('whatResources queries', function () {
    it('What resources have "bar" some rights on?', function (done) {
      var acl = new Acl(this.backend)
      
      acl.whatResources('bar', function (err, resources) {
        assert.isNull(err)
        assert.include(resources.blogs, 'view')
        assert.include(resources.blogs, 'delete')
        done()
      })
    })

    it('What resources have "bar" view rights on?', function (done) {
      var acl = new Acl(this.backend)

      acl.whatResources('bar', 'view', function (err, resources) {
        assert.isNull(err)
        assert.include(resources, 'blogs')
        done()
      })
    })
    
    it('What resources have "fumanchu" some rights on?', function (done) {
      var acl = new Acl(this.backend)

      acl.whatResources('fumanchu', function (err, resources) {
        assert.isNull(err)
        assert.include(resources.blogs, 'get')
        assert.include(resources.forums, 'delete')
        assert.include(resources.forums, 'get')
        assert.include(resources.forums, 'put')
        assert.include(resources.news, 'delete')
        assert.include(resources.news, 'get')
        assert.include(resources.news, 'put')
        done()
      })
    })
    
    it('What resources have "baz" some rights on?', function (done) {
      var acl = new Acl(this.backend)

      acl.whatResources('baz', function (err, resources) {
        assert.isNull(err)
        assert.include(resources.blogs, 'view')
        assert.include(resources.blogs, 'delete')
        assert.include(resources.blogs, 'edit')
        done()
      })
    })
  })
}