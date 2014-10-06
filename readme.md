# WORK IN PROGRESS -- NOT YET ALPHA #

# Overview #

Static site compilers are all the craze right now, but many of them require filesystem access to modify files. Additionally, they require the
running of a binary executable or script to perform the compilation. Couchsite tries to get around this by using the built in RESTful API of
CouchDB along with an engine written entirely in Javascript in the browser. This enables you to update your site from any browser without
having special permissions or running untrusted binaries. Also, since work is shifted to the web browser, you reduce the work needed to be performed on the server. This allows for leaner deployments.

## Content Document Format ##

When using Couchsite, each page of a website is stored in CouchDB as a JSON document using a special format:

```JavaScript
    {
        _id:"sample_title",
        cs:{
            type:"cs_content",
            template:"webpage",
            modified:1234567890,
            rendered:1234567890,
        },
		owner:"pokstad",
        title:"Sample Title",
        body:"This is sample content."
    }
```

* _id : URL for the rendered content.
* cs : MANDATORY: The object for all Couchsite related items
* cs.type : MANDATORY | Content documents type must be cs_content.
* cs.template : MANDATORY | This determines which template is used to render the page. See the Template Docs section.
* cs.modified : MANDATORY | an integer of the milliseconds since epoch. This can be obtained by: new Date().getTime()
* cs.rendered : MANDATORY | indicates if the current rendered static page matches the timestamp of the most recent document. If the rendered time is less than the modified timestamp, then we need to update the rendering.

After being rendered, the rendering will be stored in the attachment _attachments.cs_rendered.

```JavaScript
    {
        _id:"sample_title",
        cs:{
            type:"cs_content",
            template:"webpage",
            modified:1234567890,
            rendered:1234567890,
        },
		owner:"pokstad",
        title:"Sample Title",
        body:"This is sample content.",
		_attachments:{
			cs_rendered:{
				stub:true
			}
		}
    }
```

Any arbitrary fields may be added to extend functionality, but they must avoid being added to the "cs" object to encourage future compatability with Couchsite.

## Template Docs ##

Similar to other HTML template systems, Couchsite aims to reuse HTML code to improve maintainability. Unlike other template systems, Couchsite accomplishes this on the client side. Each template is stored as an attachment to a special document. This special document follows this format:

Similar to content docs, the template doc must follow a schema. The cs object contains all required fields:

```JavaScript
    {
        _id:"cs_template:webpage",
        cs:{
            type:"cs_template",
            syntax:"handlebars.js",
			parent:"cs_template:rootpage",
            template:"<h1>{{title}}</h1><body>{{markdown body}}</body>",
			modified:1234567890
        }
    }
```

* cs.type : MANDATORY | for templates, this must be set to "cs_template"
* cs.syntax : OPTIONAL | By default, syntax is set to "handlebars.js"
* cs.parent : OPTIONAL | If the template is a partial to be included in another referenced template (see Parent Templates)
* cs.template : OPTIONAL | Contains the template string when cs.attachment is set to false.
* cs.modified : MANDATORY | Indicates the last time the template was modified.
* _attachments.cs_template : OPTIONAL | If cs.template does not exist, then the "cs_template" attachment is used.

### Attached Templates ###

If the template is a string embedded inside the doc, then cs.template will contain the template string. If the template is attached as a file, then the _attachments.cs_template property contains the template:

```JavaScript
    {
        _id:"cs_template:webpage",
        cs:{
            type:"cs_template",
            attachment:true,
			modified:1234567890
        },
        _attachments:{
            cs_template:{
				stub:true
            }
        }
    }
```

### Parent Templates ###

Sometimes a template being used is a partial that requires an existing template to function. In these cases, a parent attribute can be set to the ID of the required parent template.

```JavaScript
    {
        _id:"cs_template:subpage",
        cs:{
            type:"cs_template",
			parent:"cs_template:rootpage",
            template:"<h1>{{title}}</h1><body>{{markdown body}}</body>",
			modified:1234567890
        }
    }
```

```JavaScript
    {
        _id:"cs_template:rootpage",
        cs:{
            type:"cs_template",
            template:"<html>{{> cs_template:subpage}}</html>",
			modified:1234567890
        }
    }
```

### Precompiling Templates ###

IN PROGRESS

Precompilation is a preemptive strategy to save time fetching and compiling templates and partials. If a child, parent, grandparent, great grandparent, etc., has been modified, then the changes will propagate downwards until all leaf nodes are precompiled. This is ideally done each time after templates are modified.

```JavaScript
    {
        _id:"cs_template:childpage",
        cs:{
            type:"cs_template",
			parent:"cs_template:parentpage",
            template:"<h1>{{title}}</h1><body>{{markdown body}}</body>",
			modified:1234567890,
			compiled:1234567890
        },
		_attachments:{
			cs_compiled:{
				stub:true
			}
		}
    }
```

The cs.compiled property indicates when the compilation occurred. A compiled template is considered outdated when the template has been modified more recently, or when any of the ancestors of a template are also modified more recently.

### Template Security Considerations ###

Since templates contain arbitrary HTML, it is strongly advised to only allow admins permission to create or modify them.

## Rendering Process ##

The rendering process is as follows:

1. Couchsite fetches a CouchDB view for all content docs to render.
1. Each document in the returned view is iterated over:
  1. Any referenced templates are fetched and cached.
  1. Any parent templates needed by referenced templates are also fetched and cached.
  1. Couchsite uses handlebars.js (default) to compile the referenced templates.
  1. The rendered page is attached to the document it originated from as a static resource.

Couchsite also uses vhosts to map the site into a pretty URL structure. This helps overcome the limitation of mapping the root ("/") directory to a page. It also helps separate the JSON documents from the static pages by moving database access to the "/db/" URL.

In addition to rendering JSON docs into HTML, Couchsite will also generate RSS feeds for blog posts and sitemaps for the entire site.

# Installation #

Installing Couchsite is easy, but there are a few prerequisites:

1. CouchDB must be installed.
2. You must have admin access to a database on CouchDB.

[Go here for CouchDB installation instructions.](http://couchdb.apache.org/)

If you are a server admin, you can create a database via curl:

```
curl -X PUT http://localhost:5984/databasename
```

## Install Couchsite via File Upload ##

Once you have your CouchDB database ready, you can install Couchsite by uploading the following javascript file to any design doc:
http://github.com/pokstad/couchsite/release/latest/couchsite.js

IN PROGRESS

## Install Via CORS ##

If you are able to enable CORS on your CouchDB server, you can go to this page and use the one click installation:
http://github.com/pokstad/couchsite/install/cors.html

To enable CORS for the above page to work, you can use this curl command:

```
curl -X PUT http://localhost:5984/_config/httpd/enable_cors -d 'true'
curl -X PUT http://localhost:5984/_config/cors/credentials -d 'true'
curl -X PUT http://localhost:5984/_config/cors/origins -d 'https://pokstad.github.io'
```

IN PROGRESS

## Install Couchsite via Replication ##

If you have access to the _replicator database, you can trigger a one time replication to copy the latest version of the demo project and use
that as a starting point. This can be done using curl:

```
curl -X PUT http://localhost:5984/_replicator -H 'Accept-Type:application/json' -d '{"source":"http://example.com/couchsite", "target":"your_local_database_name"}'
```

**PLEASE, NO CONTINUOUS REPLICATIONS.** This continually pings the server indefinitely. If I have too many people abusing the server, I will be forced to remove this option.

# Security Considerations #

To restrict other users from accessing this database, you can provide a JSON security object that specifies you as the only member:

```
curl -X PUT http://localhost:5984/databasename/_security -H 'Accept-Type:application/json' -d '{"members":["your_username"]}'
```

# Verifying Couchsite with the Test Suite #

You can verify the current build of Couchsite by running the test suite.

1. Create a document and attach the testsuite.html and couchsite_tests.js file.
2. Open the testsuite.html file.
3. Enter credentials and login.
4. Press the start button.
5. Review results.

IN PROGRESS
