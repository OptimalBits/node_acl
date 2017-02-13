var Acl = require('../')
  , assert = require('chai').assert
  , expect = require('chai').expect;

exports.Constructor = function () {
  describe('constructor', function () {
    it('should use default `buckets` names', function () {
      var acl = new Acl(this.backend)

      expect(acl.options.buckets.meta).to.equal('meta')
      expect(acl.options.buckets.parents).to.equal('parents')
      expect(acl.options.buckets.permissions).to.equal('permissions')
      expect(acl.options.buckets.resources).to.equal('resources')
      expect(acl.options.buckets.roles).to.equal('roles')
      expect(acl.options.buckets.users).to.equal('users')
    })

    it('should use given `buckets` names', function () {
      var acl = new Acl(this.backend, null, {
        buckets: {
          meta: 'Meta',
          parents: 'Parents',
          permissions: 'Permissions',
          resources: 'Resources',
          roles: 'Roles',
          users: 'Users'
        }
      })

      expect(acl.options.buckets.meta).to.equal('Meta')
      expect(acl.options.buckets.parents).to.equal('Parents')
      expect(acl.options.buckets.permissions).to.equal('Permissions')
      expect(acl.options.buckets.resources).to.equal('Resources')
      expect(acl.options.buckets.roles).to.equal('Roles')
      expect(acl.options.buckets.users).to.equal('Users')
    })
  })
}

exports.Allows = function () {
  describe('allow', function () {

   this.timeout(10000);

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
    it('joed => guest, jsmith => member, harry => admin, test@test.com => member', function (done) {
      var acl = new Acl(this.backend)

      acl.addUserRoles('joed', 'guest', function (err) {
        assert(!err)

        acl.addUserRoles('jsmith', 'member', function (err) {
          assert(!err)

          acl.addUserRoles('harry', 'admin', function (err) {
            assert(!err)

            acl.addUserRoles('test@test.com', 'member', function (err) {
              assert(!err);
              done()
            });
          })
        })
      })
    })

    it('0 => guest, 1 => member, 2 => admin', function (done) {
      var acl = new Acl(this.backend)

      acl.addUserRoles(0, 'guest', function (err) {
        assert(!err)

        acl.addUserRoles(1, 'member', function (err) {
          assert(!err)

          acl.addUserRoles(2, 'admin', function (err) {
            assert(!err);
            done()
          })
        })
      })
    })
  })

  describe('read User Roles', function() {
    it('run userRoles function', function(done) {
      var acl = new Acl(this.backend)
      acl.addUserRoles('harry', 'admin', function (err) {
        if (err) return done(err);

        acl.userRoles('harry', function(err, roles) {
          if (err) return done(err);

          assert.deepEqual(roles, ['admin']);
          acl.hasRole('harry', 'admin', function(err, is_in_role) {
            if (err) return done(err);

            assert.ok(is_in_role);
            acl.hasRole('harry', 'no role', function(err, is_in_role) {
              if (err) return done(err);

              assert.notOk(is_in_role)
              done()
            })
          })
        })
      })
    })
  })

  describe('read Role Users', function() {
    it('run roleUsers function', function(done) {
      var acl = new Acl(this.backend)
      acl.addUserRoles('harry', 'admin', function (err) {
        if (err) return done(err);

        acl.roleUsers('admin', function(err, users) {
          if (err) return done(err);
          assert.include(users, 'harry')
          assert.isFalse('invalid User' in users)
          done();
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

      acl.addUserRoles('james', 'baz', function (err) {
        assert(!err)
        done()
      })
    })
    it('add them (numeric userId)', function (done) {
      var acl = new Acl(this.backend)

      acl.addUserRoles(3, 'baz', function (err) {
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
              {resources:['forums','news'], permissions:['get','put','delete']},
              {resources:['/path/file/file1.txt','/path/file/file2.txt'], permissions:['get','put','delete']}
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
    it('do it (numeric userId)', function (done) {
      var acl = new Acl(this.backend)
      acl.addUserRoles(4, 'fumanchu', function (err) {
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

      it('Can userId=0 view blogs?', function (done) {
        var acl = new Acl(this.backend)

        acl.isAllowed(0, 'blogs', 'view', function (err, allow) {
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

      it('Can userId=0 view forums?', function (done) {
        var acl = new Acl(this.backend)

        acl.isAllowed(0, 'forums', 'view', function (err, allow) {
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

      it('Can userId=0 edit forums?', function (done) {
        var acl = new Acl(this.backend)

        acl.isAllowed(0, 'forums', 'edit', function (err, allow) {
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

      it('Can test@test.com edit forums?', function (done) {
        var acl = new Acl(this.backend)

        acl.isAllowed('test@test.com', 'forums', 'edit', function (err, allow) {
          assert(!err)
          assert(!allow)
          done()
        })
      })

      it('Can test@test.com edit forums?', function (done) {
        var acl = new Acl(this.backend)

        acl.isAllowed('test@test.com', 'forums', 'edit', function (err, allow) {
          assert(!err)
          assert(!allow)
          done()
        })
      })


      it('Can test@test.com edit blogs?', function (done) {
        var acl = new Acl(this.backend)

        acl.isAllowed('test@test.com', 'blogs', 'edit', function (err, allow) {
          assert(!err)
          assert(allow)
          done()
        })
      })

      it('Can userId=1 edit blogs?', function (done) {
        var acl = new Acl(this.backend)

        acl.isAllowed(1, 'blogs', 'edit', function (err, allow) {
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

      it('Can test@test.com edit, delete and clone blogs?', function (done) {
        var acl = new Acl(this.backend)

        acl.isAllowed('test@test.com', 'blogs', ['edit','view','clone'], function (err, allow) {
          assert(!err)
          assert(!allow)
          done()
        })
      })

      it('Can userId=1 edit, delete and clone blogs?', function (done) {
        var acl = new Acl(this.backend)

        acl.isAllowed(1, 'blogs', ['edit','view','clone'], function (err, allow) {
          assert(!err)
          assert(!allow)
          done()
        })
      })

      it('Can jsmith edit, clone blogs?', function (done) {
        var acl = new Acl(this.backend)

        acl.isAllowed('jsmith', 'blogs', ['edit', 'clone'], function (err, allow) {
          assert(!err)
          assert(!allow)
          done()
        })
      })

      it('Can test@test.com edit, clone blogs?', function (done) {
        var acl = new Acl(this.backend)

        acl.isAllowed('test@test.com', 'blogs', ['edit', 'clone'], function (err, allow) {
          assert(!err)
          assert(!allow)
          done()
        })
      })

      it('Can userId=1 edit, delete blogs?', function (done) {
        var acl = new Acl(this.backend)

        acl.isAllowed(1, 'blogs', ['edit', 'clone'], function (err, allow) {
          assert(!err)
          assert(!allow)
          done()
        })
      });

      it('Can james add blogs?', function (done) {
        var acl = new Acl(this.backend)

        acl.isAllowed('james', 'blogs', 'add', function (err, allow) {
          assert(!err)
          assert(!allow)
          done()
        })
      })

      it('Can userId=3 add blogs?', function (done) {
        var acl = new Acl(this.backend)

        acl.isAllowed(3, 'blogs', 'add', function (err, allow) {
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

      it('Can userId=4 add blogs?', function (done) {
        var acl = new Acl(this.backend)

        acl.isAllowed(4, 'blogs', 'add', function (err, allow) {
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

      it('Can userId=4 get blogs?', function (done) {
        var acl = new Acl(this.backend)

        acl.isAllowed(4, 'blogs', 'get', function (err, allow) {
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

      it('Can userId=4 delete and put news?', function (done) {
        var acl = new Acl(this.backend)

        acl.isAllowed(4, 'news', ['put','delete'], function (err, allow) {
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

      it('Can userId=4 delete and put forums?', function (done) {
        var acl = new Acl(this.backend)

        acl.isAllowed(4, 'forums', ['put','delete'], function (err, allow) {
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
          assert(!err)

          assert.property(permissions, 'blogs')
          assert.property(permissions, 'forums')

          assert.include(permissions.blogs, 'edit')
          assert.include(permissions.blogs, 'delete')
          assert.include(permissions.blogs, 'view')

          assert(permissions.forums.length === 0)

          done()
        })
      })
      it('What permissions has userId=3 over blogs and forums?', function (done) {
        var acl = new Acl(this.backend)
        acl.allowedPermissions(3, ['blogs','forums'], function (err, permissions) {
          assert(!err)

          assert.property(permissions, 'blogs')
          assert.property(permissions, 'forums')

          assert.include(permissions.blogs, 'edit')
          assert.include(permissions.blogs, 'delete')
          assert.include(permissions.blogs, 'view')

          assert(permissions.forums.length === 0)

          done()
        })
      })
      it('What permissions has nonsenseUser over blogs and forums?', function (done) {
        var acl = new Acl(this.backend)
        acl.allowedPermissions('nonsense', ['blogs','forums'], function (err, permissions) {
          assert(!err)

          assert(permissions.forums.length === 0)
          assert(permissions.blogs.length === 0)

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
        assert.include(resources['/path/file/file1.txt'], 'delete')
        assert.include(resources['/path/file/file1.txt'], 'get')
        assert.include(resources['/path/file/file1.txt'], 'put')
        assert.include(resources['/path/file/file2.txt'], 'delete')
        assert.include(resources['/path/file/file2.txt'], 'get')
        assert.include(resources['/path/file/file2.txt'], 'put')
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



exports.PermissionRemoval= function () {
  describe('removeAllow', function () {
    it('Remove get permissions from resources blogs and forums from role fumanchu', function (done) {
      var acl = new Acl(this.backend)
      acl.removeAllow('fumanchu', ['blogs','forums'], 'get', function (err) {
        assert(!err)
        done()
      })
    })

    it('Remove delete and put permissions from resource news from role fumanchu', function (done) {
      var acl = new Acl(this.backend)
      acl.removeAllow('fumanchu', 'news', 'delete', function (err) {
        assert(!err)
        done()
      })
    })

    it('Remove view permissions from resource blogs from role bar', function (done) {
      var acl = new Acl(this.backend);
      acl.removeAllow('bar', 'blogs', 'view', function (err) {
        assert(!err)
        done()
      })
    })
  })

  describe('See if permissions were removed', function () {
    it('What resources have "fumanchu" some rights on after removed some of them?', function (done) {
      var acl = new Acl(this.backend);
      acl.whatResources('fumanchu', function (err, resources) {
        assert.isNull(err)

        assert.isFalse('blogs' in resources)
        assert.property(resources, 'news')
        assert.include(resources.news, 'get')
        assert.include(resources.news, 'put')
        assert.isFalse('delete' in resources.news)

        assert.property(resources, 'forums')
        assert.include(resources.forums, 'delete')
        assert.include(resources.forums, 'put')
        done()
      })
    })
  })
}




exports.RoleRemoval = function () {
  describe('removeRole', function () {
    it('Remove role fumanchu', function (done) {
      var acl = new Acl(this.backend)
      acl.removeRole('fumanchu', function (err) {
        assert(!err)
        done()
      })
    })

    it('Remove role member', function (done) {
      var acl = new Acl(this.backend)
      acl.removeRole('member', function (err) {
        assert(!err)
        done()
      })
    })

    it('Remove role foo', function (done) {
      var acl = new Acl(this.backend)
      acl.removeRole('foo', function (err) {
        assert(!err)
        done()
      })
    })
  })

  describe('Was role removed?', function () {
    it('What resources have "fumanchu" some rights on after removed?', function (done) {
      var acl = new Acl(this.backend)
      acl.whatResources('fumanchu', function (err, resources) {
        assert(!err)
        assert(Object.keys(resources).length === 0)
        done()
      })
    })

    it('What resources have "member" some rights on after removed?', function (done) {
      var acl = new Acl(this.backend)
      acl.whatResources('member', function (err, resources) {
        assert(!err)
        assert(Object.keys(resources).length === 0)
        done()
      })
    })

    describe('allowed permissions', function () {
      it('What permissions has jsmith over blogs and forums?', function (done) {
        var acl = new Acl(this.backend)
        acl.allowedPermissions('jsmith', ['blogs','forums'], function (err, permissions) {
          assert(!err)
          assert(permissions.blogs.length === 0)
          assert(permissions.forums.length === 0)
          done()
        })
      })

      it('What permissions has test@test.com over blogs and forums?', function (done) {
        var acl = new Acl(this.backend)
        acl.allowedPermissions('test@test.com', ['blogs','forums'], function (err, permissions) {
          assert(!err)
          assert(permissions.blogs.length === 0)
          assert(permissions.forums.length === 0)
          done()
        })
      })

      it('What permissions has james over blogs?', function (done) {
        var acl = new Acl(this.backend)
        acl.allowedPermissions('james', 'blogs', function (err, permissions) {
          assert(!err)
          assert.property(permissions, 'blogs')
          assert.include(permissions.blogs, 'delete')
          done()
        })
      })
    })
  })
}





exports.RoleParentRemoval = function () {
  describe('RoleParentRemoval', function () {
    before(function (done) {
      var acl = new Acl(this.backend);
      acl.allow('parent1', 'x', 'read1')
        .then(function () { return acl.allow('parent2', 'x', 'read2'); })
        .then(function () { return acl.allow('parent3', 'x', 'read3'); })
        .then(function () { return acl.allow('parent4', 'x', 'read4'); })
        .then(function () { return acl.allow('parent5', 'x', 'read5'); })
        .then(function () {
          return acl.addRoleParents('child', ['parent1', 'parent2', 'parent3', 'parent4', 'parent5']);
        })
        .done(done, done);
    });

    var acl;

    beforeEach(function () {
      acl = new Acl(this.backend);
    });

    it('Environment check', function (done) {
      acl.whatResources('child')
          .then(function (resources) {
            assert.lengthOf(resources.x, 5);
            assert.include(resources.x, 'read1');
            assert.include(resources.x, 'read2');
            assert.include(resources.x, 'read3');
            assert.include(resources.x, 'read4');
            assert.include(resources.x, 'read5');
          })
          .done(done, done);
    });

    it('Operation uses a callback when removing a specific parent role', function (done) {
      acl.removeRoleParents('child', 'parentX', function (err) {
        assert(!err);
        done();
      });
    });

    it('Operation uses a callback when removing multiple specific parent roles', function (done) {
      acl.removeRoleParents('child', ['parentX', 'parentY'], function (err) {
        assert(!err);
        done();
      });
    });

    it('Remove parent role "parentX" from role "child"', function (done) {
      acl.removeRoleParents('child', 'parentX')
        .then(function () { return acl.whatResources('child'); })
        .then(function (resources) {
          assert.lengthOf(resources.x, 5);
          assert.include(resources.x, 'read1');
          assert.include(resources.x, 'read2');
          assert.include(resources.x, 'read3');
          assert.include(resources.x, 'read4');
          assert.include(resources.x, 'read5');
        })
        .done(done, done);
    });

    it('Remove parent role "parent1" from role "child"', function (done) {
      acl.removeRoleParents('child', 'parent1')
        .then(function () { return acl.whatResources('child'); })
        .then(function (resources) {
          assert.lengthOf(resources.x, 4);
          assert.include(resources.x, 'read2');
          assert.include(resources.x, 'read3');
          assert.include(resources.x, 'read4');
          assert.include(resources.x, 'read5');
        })
        .done(done, done);
    });

    it('Remove parent roles "parent2" & "parent3" from role "child"', function (done) {
      acl.removeRoleParents('child', ['parent2', 'parent3'])
        .then(function () { return acl.whatResources('child'); })
        .then(function (resources) {
          assert.lengthOf(resources.x, 2);
          assert.include(resources.x, 'read4');
          assert.include(resources.x, 'read5');
        })
        .done(done, done);
    });

    it('Remove all parent roles from role "child"', function (done) {
      acl.removeRoleParents('child')
        .then(function () { return acl.whatResources('child'); })
        .then(function (resources) {
          assert.notProperty(resources, 'x');
        })
        .done(done, done);
    });

    it('Remove all parent roles from role "child" with no parents', function (done) {
      acl.removeRoleParents('child')
        .then(function () { return acl.whatResources('child'); })
        .then(function (resources) {
          assert.notProperty(resources, 'x');
        })
        .done(done, done);
    });

    it('Remove parent role "parent1" from role "child" with no parents', function (done) {
      acl.removeRoleParents('child', 'parent1')
        .then(function () { return acl.whatResources('child'); })
        .then(function (resources) {
          assert.notProperty(resources, 'x');
        })
        .done(done, done);
    });

    it('Operation uses a callback when removing all parent roles', function (done) {
      acl.removeRoleParents('child', function (err) {
        assert(!err);
        done();
      });
    });
  });
};





exports.ResourceRemoval = function () {
  describe('removeResource', function () {
    it('Remove resource blogs', function (done) {
      var acl = new Acl(this.backend)
      acl.removeResource('blogs', function (err) {
        assert(!err)
        done()
      })
    })

    it('Remove resource users', function (done) {
      var acl = new Acl(this.backend)
      acl.removeResource('users', function (err) {
        assert(!err)
        done()
      })
    })
  })

  describe('allowedPermissions', function () {
    it('What permissions has james over blogs?', function (done) {
      var acl = new Acl(this.backend)
      acl.allowedPermissions('james', 'blogs', function (err, permissions) {
        assert.isNull(err)
        assert.property(permissions, 'blogs')
        assert(permissions.blogs.length === 0)
        done()
      })
    })
    it('What permissions has userId=4 over blogs?', function (done) {
      var acl = new Acl(this.backend)
      acl.allowedPermissions(4, 'blogs').then(function (permissions) {
        assert.property(permissions, 'blogs')
        assert(permissions.blogs.length === 0)
        done()
      }, done);
    })
  })

  describe('whatResources', function () {
    it('What resources have "baz" some rights on after removed blogs?', function (done) {
      var acl = new Acl(this.backend)
      acl.whatResources('baz', function (err, resources) {
        assert(!err)
        assert.isObject(resources)
        assert(Object.keys(resources).length === 0)

        done()
      })
    })

    it('What resources have "admin" some rights on after removed users resource?', function (done) {
      var acl = new Acl(this.backend)
      acl.whatResources('admin', function (err, resources) {
        assert(!err)
        assert.isFalse('users' in resources)
        assert.isFalse('blogs' in resources)

        done()
      })
    })
  })
}





exports.UserRoleRemoval = function () {
  describe('Remove user roles', function () {
    it('Remove role guest from joed', function (done) {
      var acl = new Acl(this.backend)
      acl.removeUserRoles('joed','guest', function (err) {
        assert(!err)
        done()
      })
    })

    it('Remove role guest from userId=0', function (done) {
      var acl = new Acl(this.backend)
      acl.removeUserRoles(0,'guest', function (err) {
        assert(!err)
        done()
      })
    })
    it('Remove role admin from harry', function (done) {
      var acl = new Acl(this.backend)
      acl.removeUserRoles('harry','admin', function (err) {
        assert(!err)
        done()
      })
    })

    it('Remove role admin from userId=2', function (done) {
      var acl = new Acl(this.backend)
      acl.removeUserRoles(2,'admin', function (err) {
        assert(!err)
        done()
      })
    })
  })

  describe('Were roles removed?', function () {
    it('What permissions has harry over forums and blogs?', function (done) {
      var acl = new Acl(this.backend)
      acl.allowedPermissions('harry', ['forums','blogs'], function (err, permissions) {
        assert(!err)
        assert.isObject(permissions)
        assert(permissions.forums.length === 0)
        done()
      })
      it('What permissions has userId=2 over forums and blogs?', function (done) {
        var acl = new Acl(this.backend)
        acl.allowedPermissions(2, ['forums','blogs'], function (err, permissions) {
          assert(!err)
          assert.isObject(permissions)
          assert(permissions.forums.length === 0)
          done()
        })
      })
    })
  })
}

exports.i55PermissionRemoval = function () {
  describe('Github issue #55: removeAllow is removing all permissions.', function () {
    it('Add roles/resources/permissions', function () {
      var acl = new Acl(this.backend)

      return acl.addUserRoles('jannette', 'member').then(function(){
        return acl.allow('member', 'blogs', ['view', 'update']);
      }).then(function(){
        return acl.isAllowed('jannette', 'blogs', 'view', function(err, allowed){
          expect(allowed).to.be.eql(true);
        })
      }).then(function(){
        return acl.removeAllow('member', 'blogs', 'update');
      }).then(function(){
        return acl.isAllowed('jannette', 'blogs', 'view', function(err, allowed){
          expect(allowed).to.be.eql(true);
        });
      }).then(function(){
        return acl.isAllowed('jannette', 'blogs', 'update', function(err, allowed){
          expect(allowed).to.be.eql(false);
        });
      }).then(function(){
        return acl.removeAllow('member', 'blogs', 'view');
      }).then(function(){
        return acl.isAllowed('jannette', 'blogs', 'view', function(err, allowed){
          expect(allowed).to.be.eql(false);
        });
      })
    })
  })
}

exports.i32RoleRemoval = function () {
  describe('Github issue #32: Removing a role removes the entire "allows" document.', function () {
    it('Add roles/resources/permissions', function (done) {
      var acl = new Acl(this.backend)

      acl.allow(['role1', 'role2', 'role3'], ['res1', 'res2', 'res3'], ['perm1', 'perm2', 'perm3'], function (err) {
        assert(!err)
        done()
      })
    })

    it('Add user roles and parent roles', function (done) {
      var acl = new Acl(this.backend)

        acl.addUserRoles('user1', 'role1', function (err) {
          assert(!err)

          acl.addRoleParents('role1', 'parentRole1', function (err) {
            assert(!err)
            done()
          })
        })
    })

    it('Add user roles and parent roles', function (done) {
      var acl = new Acl(this.backend)

        acl.addUserRoles(1, 'role1', function (err) {
          assert(!err)

          acl.addRoleParents('role1', 'parentRole1', function (err) {
            assert(!err)
            done()
          })
        })
    })
    it('Verify that roles have permissions as assigned', function(done){
      var acl = new Acl(this.backend)

      acl.whatResources('role1', function (err, res) {
        assert(!err)
        assert.deepEqual(res.res1.sort(), [ 'perm1', 'perm2', 'perm3' ])

        acl.whatResources('role2', function (err, res) {
          assert(!err)
          assert.deepEqual(res.res1.sort(), [ 'perm1', 'perm2', 'perm3' ])
          done()
        })
      })
    })

    it('Remove role "role1"', function(done){
      var acl = new Acl(this.backend)

      acl.removeRole('role1', function (err) {
        assert(!err)
        done()
      })
    })

    it('Verify that "role1" has no permissions and "role2" has permissions intact', function(done){
      var acl = new Acl(this.backend)

      acl.removeRole('role1', function (err) {
        assert(!err)

        acl.whatResources('role1', function (err, res) {
          assert(Object.keys(res).length === 0)

          acl.whatResources('role2', function (err, res) {
            assert.deepEqual(res.res1.sort(), [ 'perm1', 'perm2', 'perm3' ])
            done()
          })
        })
      })
    })
  })
}
