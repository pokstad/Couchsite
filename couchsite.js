/*******************************************************************************
 * CouchSite.js
 * Requirements:
 * jQuery 2.0+
 * CouchDB JQuery Plugin: https://github.com/apache/couchdb/blob/master/share/www/script/jquery.couch.js
 * Handlebars.js: 
 * Markdown:
 ******************************************************************************/
var Couchsite = (function() {
  // private vars
  var version = "0.1";
  var admin_group = "_admin";
  var default_html_filename = "index.html";
  var default_design_document = {
      _id:"_design/couchsite",
      views:{
          content_by_template:{
              map:function(doc){
				  if (doc.cs && doc.cs.type && doc.cs.type == "cs_content") {
					  emit(doc.cs.template,null);
				  }
			  },
              reduce:"_count"
          },
		  template_parents:{
			  map:function(doc) {
				  if (doc.cs && doc.cs.type && doc.cs.type == "cs_template") {
					  emit(doc._id, [cs.modified, cs.compiled]);
					  if (doc.cs.parent) {
						  emit(doc.cs.parent, [cs.modified, cs.compiled]);
					  }
				  }
			  },
			  reduce:"_count"
		  }
      },
      validate_doc_update:function(newDoc, oldDoc, user_ctx, sec_obj){
          return true;
      }
  };
  var html_content_type = "text\/html";
  var errorAlert = function(data) {
    window.alert(JSON.stringify(data));
  };
  // set up handlebars.js helper functions
  Handlebars.registerHelper('timestamp', function(epoch_ms) {
      var d = new Date(epoch_ms);
      return d.toISOString();
  });
  // exported public vars
  return {
    function_stringify:function (key, value) {
        // how to use:
        // JSON.stringify(json_doc, function_stringify)
        if (typeof value === 'function') {
            return value.toString();
        }
        return value;
    },
    utf8_to_b64:function(str) {
        return window.btoa(encodeURIComponent( escape( str )));
    },
    b64_to_utf8:function(str) {
        return unescape(decodeURIComponent(window.atob( str )));
    },
    ajaxAttachRenderedHtml:function (doc, unsafe_html, filename, callback) {
        console.log("Attaching rendered html to document: "+doc._id);
        if (doc._attachments == undefined) {
            doc._attachments = {};
        }
        if (filename == null) {
            filename = default_html_filename;
        }
        doc._attachments[filename] = {
            content_type:html_content_type,
            data:btoa(this.utf8_to_safe_html(unsafe_html))
        };
        var timestamp = new Date();
        doc.rendered = timestamp.getTime();
        // if we forgot to assign a modified property, give one now
        if (doc.modified == undefined) {
            doc.modified = doc.rendered;
        }
        // save the modified doc
        siteDB.saveDoc(doc, {
            success:function(data) {
                console.log('Success: '+JSON.stringify(data));
                callback(data);
            },
            error:errorAlert
        });
    },
    ajaxFetchUserSession:function(callback) {
        $.couch.session({
            success:function(data) {
                console.log(JSON.stringify(data));
                this.user_ctx = data.userCtx;
                callback(data);
            },
            error:errorAlert
        });
    },
    ajaxLogin:function login(username, password, callback) {
        $.couch.login({
            name:username,
            password:password,
            success:function(data){
                console.log(JSON.stringify(data));
                callback(data);
            },
            error:errorAlert
        });
    },
	couchSanitizedJson:function(dirty_json){
		return JSON.parse(this.serializeDesignDoc(dirty_json));
	},
    db_name:"db",
    design_doc:default_design_document,
    extractDocumentIdFromUrl:function(url) {
        // Blog post URLs are structured this way:
        // /URLPREFIX/DBNAME/DOCID/index.html
        var docID = url.replace(this.url_prefix,'');
        docID = docID.replace('/index.html','');
        return docID;
    },
    installDesignDoc:function(options){
		var sanitized_json = this.couchSanitizedJson(default_design_document);
		console.log("Santized json design doc: "+JSON.stringify(sanitized_json));
        this.site_db.saveDoc(sanitized_json, options);
    },
    plugins:(function(){
        var plugs = {};
        if (typeof Handlebars != 'undefined') {
            plugs = Handlebars;
            
        }
        return plugs;
    })(),
    renderAllPages:function() {
        // This function finds outdated posts and renders the html file and attaches it to the
        // corresponding document.
        siteDB.allDocs({
            include_docs:true,
            success:function (all_docs) {
                console.log("Retrieved "+all_docs.rows.length+" docs for rendering.");
                for (var i in all_docs.rows) {
                    var doc = all_docs.rows[i].doc;
                    renderPageForDoc(doc);
                }
            }
        });
    },
    renderHtml:function(template, doc) {
        // update the body_html if the body_markdown has been updated
        if (doc.body_markdown != undefined) {
            doc.body_html = markdownConverter.makeHtml(doc.body_markdown)
        }
        return indexhtml_template(doc);
    },
    renderPageForDoc:function(doc) {
        if (doc.type != "post") {
            console.log("Doc type is not renderable type: "+doc._id);
            return;
        }
        console.log("Rendering page for document: "+doc._id);
        if (indexhtml_template == null) {
            // Obtain an unaltered copy of the index.html template file
            $.get('/static/index.html', function (template) {
                if (template == null) {
                    console.log("ERROR: Template for index.html could not be retrieved.");
                    return;
                }
                indexhtml_template = Handlebars.compile(template);
                renderPageForDoc(doc);
            });
        } else {
            console.log("Rendering blog post: "+JSON.stringify(doc._id));
            // Render the content of the page using the current document
            var html = renderHtml(indexhtml_template, doc);
            // Attach this rendered string into the document as an attachment
            attachRenderedHtml(doc, html);
        }
    },
    renderPageForId:function(id) {
        siteDB.openDoc(id, {
            success:function (doc) {
                this.renderPageForDoc(doc);
            },
            error:function(status) {
                console.log("Error: Could not find doc with ID: "+id);
            }
        });
    },
    serializeDesignDoc:function(options){
        return JSON.stringify(this.design_doc, this.function_stringify);
    },
	site_db:null,
    user_ctx:null,
    url_prefix:"/",
    utf8_to_safe_html:function(stringypoo) {
        var newstring = "";
        for (var i in stringypoo) {
            var cur_char = stringypoo[i];
            try {
                btoa(cur_char);
            } catch(e) {
                console.log("Replacing char "+cur_char+" with code: "+cur_char.charCodeAt(0));
                cur_char = "&#"+cur_char.charCodeAt(0);
            }
            newstring+=cur_char;
        }
        return newstring;
    }
  };
}());