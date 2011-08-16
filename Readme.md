#NODE ACL - Access Control Lists for Node

This module provides a minimalistic ACL implementation inspired by Zend_ACL using Redis as persistent backend.


##Features

- Users
- Roles
- Hierarchies
- Resources
- Express middleware for protecting resources.
- Flexible API, only one function call needed to set up all permissions on all resources removes the need for nesting of asynchronous calls.


##Instalation

Using npm:

	npm install acl

##Examples

Create your acl module by requiring it and instantiating it with a valid node_redis instance and an optional prefix:

	var acl = require('acl')
	acl = new acl(redisClient)

All the following functions take a callback with an err parameter as last parameter. We omit it in the examples for simplicity.

Create roles implicitly by giving them permissions:

	// guest is allowed to view blogs
	acl.allow('guest', 'blogs', 'view')

	// allow function accepts arrays as any parameter
	acl.allow('member', 'blogs', ['edit','view', 'delete'])


Users are likewise created implicitly by assigning them roles:

	acl.addUserRoles('joed', 'guest')


Hierarchies of roles can be created by assigning parents to roles:

	acl.addRoleParents('baz', ['foo','bar'])


Note that the order in which you call all the functions is irrelevant (you can add parents first and assign permissions to roles later)

	acl.allow('foo', ['blogs','forums','news'], ['view', 'delete'])


Use the wildcard to give all permissions:

	acl.allow('admin', ['blogs','forums'], '*'


Sometimes is necessary to set permissions on many different roles and resources. This would
lead to unnecessary nested callback for handling errors. Instead use the following:

	acl.allowEx([{roles:['guest','member'], 
                    allows:[
                          {resources:'blogs', permissions:'get'},
                          {resources:['forums','news'], permissions:['get','put','delete']}]
				},
			    {roles:['gold','silver'], 
                    allows:[
                          {resources:'cash', permissions:['sell','exchange']},
                          {resources:['account','deposit'], permissions:['put','delete']}]
				}
				]})
(Note: allowEx will soon be deprecated and integrated in allow)



You can check if a user has permissions to access a given resource with *isAllowed*:

	acl.isAllowed('joed', 'blogs', 'view', function(err, res){
		if(res){
			console.log("User joed is allowed to view blogs")
		}
	}


Of course arrays are also accepted in this function:

	acl.isAllowed('jsmith', 'blogs', ['edit','view','delete'])

Note that all permissions must be full filed in order to get *true*.


Sometimes is necessary to know what permissions a given user has over certain resources:

	acl.allowedPermissions('james', ['blogs','forums'], function(err, permissions){
		console.log(permissions)
	})

It will return an array of resource:[permissions] like this:

	[{'blogs' : ['get','delete']},
     {'forums':['get','put']}]


Finally, we provide a middleware for Express for easy protection of resources. 

	var restrictAccess = acl.middleware

We can protect a resource like this:

	app.put('/blogs/:id', restrictAccess, function(req, res, next){…}

The middleware will protect the resource named by *req.url*, pick the user from *req.session.userId* and check the permission for *req.method*, so the above would be equivalent to something like this:

	acl.isAllowed(req.session.userId, '/blogs/12345', 'put')

The middleware accepts 3 optional arguments, that are useful in some situations. For example, sometimes we 
cannot consider the whole url as the resource:

	app.put('/blogs/:id/comments/:commentId', restrictAccess(3), function(req, res, next){…}

In this case the resource will be just the three first components of the url (without the ending slash).

It is also possible to add a custom userId or check for other permissions than the method:

	app.put('/blogs/:id/comments/:commentId', restrictAccess(3, 'joed', 'post'), function(req, res, next){…}


##Tests

Run tests with vows:
 	vows test/*

##Persistence

Currently the persistence is achieved using redis, which was chosen due to its excellent support for
set operations that are heavily used by acl. 

## Future work

- Support for removing roles, users, allowances.
- Support for denials (deny a role a given permission)


##License 

(The MIT License)

Copyright (c) 2009-2010 Manuel Astudillo <manuel@optimalbits.com>

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
