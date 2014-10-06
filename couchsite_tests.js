/**********************************************************************
 * All tests to verify the functionality of couchsite library are here.
 */

var CouchsiteTestSuite = (function() {
    var errorAlert = function(data) {
      window.alert(JSON.stringify(data));
    };
    return {
        username:null,
        password:null,
        user_ctx:null,
		test_results:$("#tests_run"),
        test_db_name:"couchsite_testbed",
        testDataUrl:'./documentation.json',
        installDesignDoc:function(options){
			var _this = this;
            Couchsite.installDesignDoc({success:function(resp){
            	_this.log_test_results("Installed design doc: "+JSON.stringify(resp));
				if(options.success){options.success(options)};
            }});
        },
		log_test_results:function(result){
			this.test_results.append("<li>"+result+"</li>");
			console.log("Appending test result: "+result);
		},
        createTestDatabase:function(options){
			console.log("Create test database");
            
            if (this.user_ctx==null) {
                throw {error: "User session is null"};
            }
			var _this = this; // async changes scope
			$.couch.allDbs({success:function(db_list) {
				if (_this.test_db_name == null) {
					_this.determineTempDatabaseName(db_list);
				}
				Couchsite.site_db = $.couch.db(_this.test_db_name);
				if (db_list.indexOf(_this.test_db_name) == -1) {
					_this.log_test_results("Creating database with name: "+_this.test_db_name);
					Couchsite.site_db.create(options);
				} else if (options.success) {
					options.success(options);
				}
			}});
        },
        determineTempDatabaseName:function(db_list){
            var _this = this; // async changes scope
            var randomName = _this.generateRandomDbName();
            while (db_list.indexOf(randomName) != -1) {
                randomName = _this.generateRandomDbName();
            };
            _this.test_db_name = randomName;
			console.log("Using random database name: "+randomName);
			return randomName;
        },
        generateRandomDbName:function(){
			function randomString(length, chars) {
			    var result = '';
			    for (var i = length; i > 0; --i) result += chars[Math.round(Math.random() * (chars.length - 1))];
			    return result;
			}
			return randomString(8, 'abcdefghijklmnopqrstuvwxyz');
        },
        populateContent:function(options){
            this.log_test_results("Populating test database");
			var test_docs = [
				{
					_id:"page1",
					cs:{
						type:"cs_content",
						template:"cs_template:root",
						timestamp:new Date().getTime()
					},
					owner:"test_user",
					title:"Sample Title",
					body:"# Test Page 1 #\nThis site is legit"
				},
				{
					_id:"cs_template:root",
					cs:{
						type:"cs_template",
						syntax:"handlebars.js",
						template:"<h1>{{title}}</h1><div>{{markdown body}}</div>{{> footer}}"
					}
				},
				{
					_id:"cs_template:body",
					cs:{
						type:"cs_template",
						syntax:"handlebars.js",
						template:"<div>Copyright {{owner}} {{format_date timestamp}}</div>"
					}
				}
			];
			for (var i in test_docs) {
				var doc = test_docs[i];
				Couchsite.site_db.saveDoc(doc, {success:function(r){
					console.log("Test doc saved: "+JSON.stringify(r));
				}});
			}
            if(options.success){options.success(options)};
        },
        renderSite:function(options){
			this.log_test_results("Rendering static content");
			Couchsite.renderSite(options)
        },
        runTestSuite:function(){
			console.log("Running the test suite.")
            var _this = this; // async changes scope
            _this.createTestDatabase({success:function(){
                _this.populateContent({success:function(){
                    _this.installDesignDoc({success:function(){
                        _this.renderSite({success:function(){
                            _this.verifySite({success:null});
                        }});
                    }});
                }});
            }});
        },
        setCredentials:function(username,password) {
            this.username=username;
            this.password=password;
			var _this = this; // async changes scope
            $.couch.login({
                name:this.username,
                password:this.password,
                success:function(user_ctx){
                    _this.user_ctx = user_ctx;
                    console.log("this.user_ctx: "+JSON.stringify(_this.user_ctx));
                },
                error:errorAlert
            });
        },
        verifySite:function(options){
			this.log_test_results("Verifying site compilation");
            if(options.success){options.success(options)};
        }
    };
}());
