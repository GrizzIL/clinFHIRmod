angular.module("sampleApp").service('resourceCreatorSvc',
    function($q,$http,RenderProfileSvc,appConfigSvc,ResourceUtilsSvc,GetDataFromServer,$localStorage,Utilities,$sce) {


    var currentProfileEl;     //the profile being used...
    var currentProfile;         //the profile in use
        
    //function to capitalize the first letter of a word...
    String.prototype.toProperCase = function () {
        return this.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
    };

    //get the extension type (single, complex) and data type from the ExtensionDefinition (StructureDefinition).

    //todo - for now, assume simple
    this.processExtensionDefinition = function(sd){
        var vo = {type:'simple'};
        if (sd && sd.snapshot && sd.snapshot.element) {
            sd.snapshot.element.forEach(function(ed){
                var path = ed.path;
                if (path.indexOf('.value')) {
                    vo.type = ed.type
                }
            })
        }

        return vo;
    };

    return {
        getPatientOrSubjectReferenceED : function(){
            //locate an ED that is a reference to a patient - either 'patient' or 'subject' as the second element in the path
            if (this.currentProfile) {
                for (var i=0; i<this.currentProfile.snapshot.element.length; i++) {
                    var ed = this.currentProfile.snapshot.element[i];
                    var ar = ed.path.split('.')
                    if (ar.length == 2) {
                        if (ar[1] == 'patient' || ar[1] == 'subject') {
                            return ed;
                            break;
                        }
                    }
                }
            }
        },
        findPatientsByName : function(name) {


            var qry = appConfigSvc.getCurrentDataServer().url + "\Patient?name="+name;
           
            return $http.get(qry);
        },
        getJsonFragmentForDataType : function(dt,results) {
            //create a js object that represents a fragment of data for inclusion in a resource based on the datatype...

            var fragment;


            
                //the actual data entry elements will depend on the datatype...
                switch ( dt) {

                    case 'Money':
                        var qty = {value:results.money_amount,units:results.money_units};
                        var text = qty.value  + " " + qty.units;
                        addValue(qty,'Money',text,false);
                        break;

                    case 'positiveInt':
                        var qty = results.positiveint;
                        var text = results.positiveint;
                        addValue(qty,'positiveInt',text,true);
                        break;

                    case 'integer':
                        var qty = results.integer;
                        var text = results.integer;
                        addValue(qty,'integer',text,true);
                        break;

                    case 'decimal':
                        var qty = results.decimal;
                        var text = results.decimal;
                        addValue(qty,'decimal',text,true);
                        break;


                    case 'ContactPoint' :
                        var use = results.ct.use;
                        var system = results.ct.system;
                        var value = results.ct.value;

                        var ct = {use:use,system:system,value:value};
                        addValue(ct,'ContactType',use + " "+ system + " " + value,false);
                        break;

                    case 'HumanName' :
                        var text = results.hn.text;
                        var hn = {use:results.hn.use,text:text};
                        if (results.hn.fname) {
                            hn.given=[results.hn.fname]
                        }
                        if (results.hn.lname) {
                            hn.family=[results.hn.lname]
                        }

                        addValue(hn,'HumanName',text,false);
                        break;

                    case 'Address' :
                        var use = results.addr.use;
                        var text = results.addr.text;
                        var address = {use:use,text:text};
                        addValue(address,'Address',use + " " + text,false);
                        break;


                    case 'Timing' :

                        var timing = {repeat:{}};

                        timing.repeat.duration = results.timing.duration;
                        timing.repeat.durationUnits = results.timing.units;
                        timing.repeat.frequency = results.timing.freq;
                        timing.repeat.frequencyMax = results.timing.freq_max;
                        timing.repeat.durationperiod =results.timing.period;
                        timing.repeat.periodMax = results.timing.period_max;
                        timing.repeat.periodUnits = results.timing.period_units;
                        timing.repeat.when = results.timing.when

                        var daStart = moment(results.timing_start).format();
                        var daEnd = moment(results.timing_end).format();


                        timing.bounds = {start: daStart,end: daEnd};

                        var text = results.timingDescription;
                        addValue(timing,'Timing',text,false);

                        break;


                    //---------

                    case 'Ratio' :

                        var num = {value:results.ratio_num_amount,units:results.ratio_num_units};
                        var denom = {value:results.ratio_denom_amount,units:results.ratio_denom_units};
                        var ratio = {numerator : num,denominator:denom};
                        var text = num.value + " " + num.units+ " over " + denom.value + " " + denom.units;
                        addValue(ratio,'Ratio',text,false);
                        break;

                    case 'Quantity' :

                        var qty = {value:results.quantity_amount,unit:results.quantity_units};

                        var text = qty.value  + " " + qty.units;
                        addValue(qty,'Quantity',text,false);


                        break;

                    case 'Range' :

                        var st = {value:results.range_amount_start,units:results.range_units};
                        var en = {value:results.range_amount_end,units:results.range_units};

                        var range = {low:st,end:en};
                        var text = "Between " + st.value + " and " + en.value + " " + st.units;
                        addValue(range,'Range',text,false);



                        break;

                    case 'Annotation' :
                        var anot = {text:results.annotation.text,authorString : results.annotation.authorString};
                        addValue(anot,'Annotation',anot.text,false);
                        break;
                    case 'Narrative' :
                        //add the narrative as a value to the root element
                        profile.snapshot.element[0].valueNarrative = results.narrative;
                        break;
                    case 'string' :
                        addValue(results.string,'String',results.string,true);
                        break;
                    // case 'id' :
                    //   addValue(results.id,'String',results.id);
                    // break;

                    case 'uri' :
                        addValue(results.uri,'uri',results.uri,true);
                        break;

                    case 'date' :

                        var da = moment(results.date_start).format("YYYY-MM-DD");

                        addValue(da,'Date',da,true);
                        break;
                    case 'dateTime' :
                        var da = moment(results.date_start).format();

                        addValue(da,'DateTime',da,true);

                        break;
                    case 'instant' :

                        var time = moment(results.time); //the time component. the date is set to the current date

                        var da = moment(results.date_start);// the date .format();

                        time.set('year',da.get('year'))
                        time.set('month',da.get('month'))
                        time.set('date',da.get('date'))


                        addValue(time.format(),'instant',time.format(),true);

                        break;
                    case 'code' :
                        addValue(results.code,'Code',results.code,true);
                        break;
                    case 'Coding' :
                        var coding = results.coding;
                        addValue(coding,'Coding',"",false);
                        break;
                    case 'CodeableConcept' :

                        var cc = results.cc;
                        var ccText = results.ccText;
                        //if represented as a set of radio buttons, then the response is a json string not an object
                        if (cc && angular.isString(cc)) {
                            try {
                                cc = JSON.parse(cc);
                            } catch (ex) {
                                alert('There was an error saving the CodeableConcept. Likely the response from theTerminology' +
                                    'server was not understood. The data is NOT saved. Sorry about that')
                                return;
                            }

                        }



                        //todo - the expansion is returning an extension with more info - may be useful later...
                        if (cc && cc.extension) {
                            delete cc.extension;
                        }

                        var newCC;      //this will be teh cc that we are saving...
                        if (cc) {
                            //var ccText = cc.display;
                            newCC = {coding:[cc]};

                        } else {
                            newCC = {};
                        }

                        if (!ccText) {  //the user didn't enter any text...
                            if (newCC.coding) {     //but they did select an option...
                                ccText = newCC.coding[0].display;
                            } else {
                                //WTF - no selection or text???
                                return;
                            }

                        }

                        newCC.text = ccText;
                        addValue(newCC,'CodeableConcept',ccText,false);
                        break;
                    case 'Reference' :
                        if (results.resourceItem) {
                            //a real resource was selected
                            var selectedResource = results.resourceItem.resource;

                            var v = {reference: selectedResource.resourceType + "/" + selectedResource.id};



                            if (results.resourceItemText) {
                                v.display = results.resourceItemText;
                            } else {
                                v.display = ResourceUtilsSvc.getOneLineSummaryOfResource(selectedResource);
                            }


                            var referenceDisplay = "";
                            if (selectedResource.text) {
                                referenceDisplay = selectedResource.text.div
                            }


                            addValue(v,'Reference',referenceDisplay,false);
                        } else {
                            //no resource selected - was there any text?
                            if (results.resourceItemText) {
                                var v = {display: results.resourceItemText};
                                addValue(v,'Reference',results.resourceItemText);
                            }

                        }
                        break;
                    case 'Identifier' :
                        var v = {'system': results.identifier_system,value:results.identifier_value};
                        addValue(v,'Identifier',results.identifier_value,false);
                        break;
                    case 'Period' :

                        var daStart = moment(results.date_start).format('YYYY-MM-DD');
                        var daEnd = moment(results.date_end).format('YYYY-MM-DD');


                        var display = 'From'+ moment(results.date_start).format('YYYY-MM-DD');
                        display += ' to '+ moment(results.date_end).format('YYYY-MM-DD');
                        var v = {start: daStart,end: daEnd};

                        if (results.period.startOnly) {
                            display = 'From'+ moment(results.date_start).format('YYYY-MM-DD');
                            v = {start: daStart};
                        }


                        addValue(v,'Period',display,false);
                        break;
                    case 'Age' :


                        //this is being set as a JSON string rather than an object - I'm not sure why...
                        var units = JSON.parse(results.ageunits);
                        var v = {value: results.age.value,
                            units: units.display,
                            system:'http://ucum.org',
                            code:units.code};



                        addValue(v,'Age',results.age.value + " "+units.display,true);
                        break;
                    case 'boolean' :
                        var v = results.boolean;
                        addValue(v,'Boolean',v ? 'Yes' : 'No',true)
                        break;

                }

                return fragment;


            //set the return value. Copied from the original - hence the (currently) unused elements
            function addValue(v,dataType,text,isPrimitive) {


                fragment = {value:v,text:text};

            }



        },
        getRootED : function(path) {
          //return the elementdefinition for the root element of the profile - always the first one...

            if (this.currentProfile && this.currentProfile.snapshot && this.currentProfile.snapshot.element) {
                return this.currentProfile.snapshot.element[0];
            }


        },
        getEDForPath : function(path) {
            var edList = [];
            this.currentProfile.snapshot.element.forEach(function(ed){
                if (ed.path == path) {
                    edList.push(ed)
                }
            })
            return edList;

        },
        getPossibleChildNodes : function(ed){
            
            //given an element definition, return a collection of the possible child nodes. Needs to be a promise as
            //it may need to resolve references to extension definitions...
            var deferred = $q.defer();
            var that = this;
            //these are nodes whose path has one more '.' - eg if ed.path = Condition.stage, then Condition.stage.summary is included
            var exclusions=['id','meta','implicitRules','language','text','contained','modifierExtension'];
            var children = [];      //the array of potential child nodes...
            var queries = [];         //a list of async queries required to resolve extensions...
            var path = ed.path;     //the path of this ed. child nodes will have this as a parent, and one more dot in the path
            var pathLength = path.length;
            var dotCount = (path.split('.').length);
            angular.forEach(this.currentProfile.snapshot.element,function(elementDef){
                var elPath = elementDef.path;
                var ar = elPath.split('.');

                if (elPath.substr(0,pathLength) == path && ar.length == dotCount+1) {
                    //only add children that are not in the exclusion list. Will need to change this when we implement extensions...
                    var propertyName = ar[dotCount];  //the name of the property in the resource

                    //if this is an extension, then need to see if there is a profile in the type. If it is, then
                    //this is an extension attached to the profile so needs to be rendered...
                    if (propertyName == 'extension') {      //todo need to think about modifierExtensions
                        //if there is a profile against the type, it points to the defintion of the extension. Only include it if it does...

                        //so this is an extension. have we already processed this node?
                        if (elementDef.myData && elementDef.myData.isExtension) {
                            children.push(elementDef);
                        } else {
                            //nope. not processed. see if there is a profile (SD) we can load to figure out the datatype...


                        if (elementDef.type && elementDef.type[0].profile ) {
                            //so we need to retrieve the definition of the profile, and update the list of elements.
                            //this will be an asynchronous operation, so add it to the list......

                            var displayName = elementDef.name;

                            elementDef.myData = {display:displayName,displayClass:"elementExtension"};
                            if (elementDef.min !== 0) {
                                elementDef.myData.displayClass += 'elementRequired ';
                            }

                            var profileUrl = elementDef.type[0].profile;     //the Url of the profile
                            queries.push(GetDataFromServer.findConformanceResourceByUri(profileUrl).then(
                                function(sdef) {

                                    
                                    elementDef.myData.extensionDefinition = sdef;   //save the full definition for later...
                                    elementDef.myData.isExtension = true;
                                    elementDef.myData.extensionDefUrl = profileUrl[0];      //it's an array (not sure why)

                                    //process the definition to get the datatype and url...

                                    //todo - move this to another service - and accomodate complex extensions...
                                    //complex extensions will have a 'backboneelement' and child nodes so a lot more complicated...

                                    //analyse the extension definition - eg is it complex or not?

                                    var analysis = Utilities.analyseExtensionDefinition(sdef);

                                    if (analysis.complexExtension) {
                                        //this is a complex extension...
                                        elementDef.type = [{code:'Complex'}]
                                        elementDef.analysis = analysis;
                                    } else {
                                        //this is a simple extension


                                        if (sdef && sdef.snapshot && sdef.snapshot.element) {
                                            sdef.snapshot.element.forEach(function(ed){
                                                var path = ed.path;
                                                if (path.indexOf('.value') > -1) {
                                                    elementDef.type = ed.type;  //this is the type from the extension definition

                                                }
                                            })
                                        }
                                        //elementDef.type = analysis.dataTypes;



                                        /*
                                        if (analysis.dataTypes) {
                                            elementDef.type = analysis.dataTypes[0];
                                        } else {
                                            elementDef.type="Unknown";
                                        }*/

                                    }


/*
                                    if (sdef && sdef.snapshot && sdef.snapshot.element) {
                                        sdef.snapshot.element.forEach(function(ed){
                                            var path = ed.path;
                                            if (path.indexOf('.value') > -1) {
                                                elementDef.type = ed.type;  //this is the type from the extension definition
                                                
                                            }
                                        })
                                    }
                                    */


                                },
                                function(err) {
                                    alert('Error retrieving '+ profileUrl + " "+ angular.toJson(err))
                                }
                            ));





                            children.push(elementDef);

                        }

                        }

                    } else {
                        //this is not an extension - don't include the standard components...
                        if (exclusions.indexOf(propertyName) == -1) {
                            elementDef.myData = {display:propertyName,displayClass:""};
                            if (elementDef.min !== 0) {
                                elementDef.myData.displayClass += 'elementRequired ';
                            }

                            if (elementDef.type && elementDef.type[0].code == 'BackboneElement') {
                                elementDef.myData.displayClass += "backboneElement";
                            }

                            //check the max value - forge leaves these elements in the snapshot...

                            if (elementDef.max != '0') {
                                children.push(elementDef);
                            }

                        }
                    }

                }





            });

            //Are there any extensions that need to be resolved?
            if (queries.length > 0) {
                //yes - execute all the queries and resolve when all have been completed...
                $q.all(queries).then(
                    function() {
                        deferred.resolve(children);
                    },
                    function(err){
                        alert("error getting SD's for children "+angular.toJson(err))
                    }
                )

            } else {
                //no - we can return the list immediately...
                deferred.resolve(children)

            }

            return deferred.promise;
        },
        canRepeat : function(ed) {
            //whether the element can repeat...
            if (ed) {
                var multiple = true;

                if (ed.base && ed.base.max) {
                    //the base property is used in profiled resources...
                    if (ed.base.max == '1') {
                        multiple = false;
                    }
                } else {
                    //this must be one of the core resource defintions...
                    if (ed.max == '1') {
                        multiple = false
                    }
                }
                return multiple;
            }
            return false;

        },
        buildResource : function(type,treeObject,treeData,config) {
            //create the sample resource...
            //console.log(treeData);
            //console.log(treeObject);
            var resource = {resourceType:type};
            if (config.profile) {
                resource.meta = resource.meta || {};
                resource.meta.profile = config.profile
            }

            //resource.extension=[]
            //create an object hash of the treeData
            var treeHash = {};
            for (var i=0; i<treeData.length; i++) {
                var node = treeData[i];
                treeHash[node.id] = node;
            }

            var canRepeat = this.canRepeat;     //allows functions in this block to access the canRepeat function outside...



            function addChildrenToNode(resource,node,text) {
                //add the node to the resource. If it has children, then recursively call
                var lnode = treeHash[node.id];


                var path = lnode.path;
                var ar = path.split('.');
                var propertyName = ar[ar.length-1];



                if (propertyName.indexOf('[x]') > -1) {
                    //this is a polymorphic field...

                    //capitilize the first letter - leave the rest as-is
                    var dt = lnode.dataType.code;   //the selected datatype
                    dt = dt.charAt(0).toUpperCase() + dt.substr(1);

                    propertyName = propertyName.slice(0, -3) + dt;
                   
                }

                //a value of false is valid for boolean - hence the simple check is not enough...
                if (typeof lnode.fragment != 'undefined'&& lnode.fragment != null ) {
                //if (lnode.fragment) {
                    //if the 'resource' is an array, then there can be multiple elements...

                    //this should never occur..
                    if (angular.isArray(resource)) {
                        alert('array passed  - This is an error, please tell the author of clinFHIR!')
                        var o = {};
                        o[propertyName] = lnode.fragment;
                        resource.push(o)

                    } else {

                        //is this is repeating element?
                        var cr = canRepeat(lnode.ed);

                        if (propertyName == 'extension') {

                            var url = lnode.ed.myData.extensionDefUrl;      //the Url to the profile

                            var dt = 'value'+lnode.dataType.code.toProperCase();

                            resource.extension = resource.extension || [];
                            var extensionFragment = {url:url};
                            extensionFragment[dt] = lnode.fragment;

                            resource.extension.push(extensionFragment);



                        } else {
                            //if a repeating elment then it is in an array...
                            if (cr) {
                                resource[propertyName] = resource[propertyName] || []
                                resource[propertyName].push(lnode.fragment)
                            } else {
                                resource[propertyName] = lnode.fragment;
                                text.value += lnode.display + ' ';
                            }

                        }


                    }


                }



                //now process any chldren of this node...
                if (node.children && node.children.length > 0) {
                    node.children.forEach(function(child){
                        var childNodeHash = treeHash[child.id];
                        var ed = childNodeHash.ed;      //the element definition describing this element
                        //is this a backbone
                        if (ed && ed.type) {
                            if (ed.type[0].code == 'BackboneElement') {
                                //yes! a backbone element. we need to create a new object to act as teh resource
                                var ar1 = ed.path.split('.');
                                var pName = ar1[ar1.length-1];


                                var obj;
                                //is this a repeating node? - ie an array...
                                var cr = canRepeat(ed);
                                obj = {};
                                if (cr) {
                                    //this is a repeating element. Is there already an array for this element?
                                    if (! resource[pName]) {
                                        resource[pName] = [];
                                    }
                                    resource[pName].push(obj);


                                } else {
                                    //this is a singleton...
                                    resource[pName] = obj;
                                }


                                addChildrenToNode(obj,child,text)
                            } else {

                                addChildrenToNode(resource,child,text)
                            }


                        } else {
                            //no, just add to the resource
                            addChildrenToNode(resource,child,text)
                        }



                    })
                }

            }


            var text = {value:""};
            addChildrenToNode(resource,treeObject,text);

            return resource;


        },
        addPatientToTree: function(path, patient, treeData) {
            //add the patient reference to the tree  path = path to patient, patient = patient resource, treeData = data for tree

            if (patient) {
                var fragment = {reference:'Patient/'+patient.id,display:ResourceUtilsSvc.getOneLineSummaryOfResource(patient)};
                //path = the path in the resource - relative to the parent
                //fragment = the json to render at that path. If a 'parent' in the resource (node type=BackboneElement) - eg Condition.Stage then the fragment is empty.
                // var patientNode = getElementDefinitionFromPath(path)
                var edList = this.getEDForPath(path);
                var ar = path.split('.');
                var patientPropertyName = ar[1];
                treeData.push({id:'patient',parent:'root',text:patientPropertyName,path:path,ed:edList[0],fragment:fragment});

            }


        },
        setCurrentProfile : function(profile) {
            this.currentProfile = profile;
        },
        getCurrentProfile : function(){
            return this.currentProfile;
        },
        getProfileDEP : function(type){
                var deferred = $q.defer();
                var that=this;

                $http.get("artifacts/"+type+".json").then(
                    function(data) {
                        that.currentProfile = data.data;
                        deferred.resolve(data.data)
                    }
                );
                return deferred.promise;


            },
        dataTypeSelected : function(dt,resourceProfile, results,element,scope,allResources) {
            //todo - get rid of the scope...
            //dt = dataType
            //resourceType - selected resourceType if a resource reference
            //element = elementDefinition 
            //scope = really shouldn't be here
            //allResources = all resources for the current patient...
            
            switch (dt) {

                case 'Period' :
                    results.period = {startOnly:false};
                    break;

                case 'Quantity' :

                    scope.showWaiting = true;
                    //age-units
                    GetDataFromServer.getExpandedValueSet('ucum-common').then(
                        function(vs) {

                            scope.showWaiting = false;
                            scope.ucum = vs.expansion.contains;
                        }, function(err){
                            scope.showWaiting = false;
                            alert("Unable to get the UCUM codes, you can still enter them manually");
                            console.log(err)

                        }
                    );
                    break;


                case 'Identifier' :


                    //see if there is a constraint in identifier system - if so, then set it as a default...
                    if (element.constraint) {
                        var search = 'identifier[system/@value=';
                        element.constraint.forEach(function(con){
                            if (con.xpath && con.xpath.indexOf(search)>-1) {
                                var g = con.xpath.indexOf('=');
                                var system = con.xpath.substr(g+1);
                                system = system.replace(/]/g,"");
                                results.identifier_system = system;
                            }
                        })
                    };


                    break;

                case 'ContactPoint' :
                    results.ct = {use:'home',system:'mobile'};
                    break;

                case 'HumanName' :
                    results.hn = {use:'usual'};
                    break;

                case 'Address' :
                    results.addr = {use:'home'};
                    break;

                case 'Narrative' :
                    //enter extra narrative
                    results.narrative = ""; //todo scope.profile.snapshot.element[0].valueNarrative;
                    break;

                case 'Annotation' :
                    //enter extra narrative
                    results.annotation = {text:'',authorString:''};
                    break;


                case 'Age' :
                    scope.UCUMAgeUnits = Utilities.getUCUMUnits('age');
                    break;

                case 'Money' :
                    scope.UCUMMoneyUnits = Utilities.getUCUMUnits('money');
                    break;

                case 'Reference' :
                    //todo - have a service that creates a full summary of a resource - and a 1 liner for the drop down
                   //todo - right now, we will assume the type being references is a base resource
                    //var ar = resourceProfile.split('/');
                    //var resourceType = ar[ar.length-1];


                    //var referenceProfile = element.type[scope.index].profile[0];  //the profile of the resource being referenced...
                   // if (! RenderProfileSvc.isUrlaBaseResource(referenceProfile)) {
                    if (! RenderProfileSvc.isUrlaBaseResource(resourceProfile)) {
                        //this is a reference to profile on a base resource. need to load the profile so we can figure out the base type
                        scope.profileUrlInReference = referenceProfile;

                        GetDataFromServer.findConformanceResourceByUri(referenceProfile).then(  //will go to the current conformance server
                            function(profile){
                                var resourceType = profile.constrainedType;//  Utilities.getResourceTypeFromUrl();
                                scope.resourceType = resourceType;
                                scope.selectedReferenceResourceType = RenderProfileSvc.getResourceTypeDefinition(resourceType) ;//  scope.resourcetypes[resourceType];
                                //todo -this won;t be correct...
                                //-temp- scope.externalReferenceSpecPage = "http://hl7.org/fhir/2015May/" + resourceType + ".html";
                                //todo - need to pass the profilein as welll

                                //if this is a 'reference' type resource (lkike origanization)t then don't
                                //incldue any of thm in the list

                                scope.resourceList = RenderProfileSvc.getResourcesSelectListOfType(
                                    allResources,resourceType,profile.url);

                            },
                            function(err) {
                                alert('Unable to retrieve the StructureDefinition for '+referenceProfile)
                            }
                        )


                    } else {
                        //this is a base resource. ..

                        var ar = resourceProfile.split('/');
                        var resourceType = ar[ar.length-1];         //the type name (eg 'Practitioner')
                        
                        //if any resource can be referenced here - ie not a specific type
                        if (resourceType== 'Resource') {
                            //scope.uniqueResources will be a collection of all the resource types for this patient
                            //todo - it's not implemented yet...
                            scope.uniqueResources = RenderProfileSvc.getUniqueResources(allResources);
                        } else {
                            delete scope.uniqueResources;
                        }

                        //this defines the resource type - eg whether it is a reference resource rather than linked to a patient...
                        scope.selectedReferenceResourceType = RenderProfileSvc.getResourceTypeDefinition(resourceType);

                        //scope.resourceType = resourceType;


                        //if the resource type is one that is a 'reference' - ie doesn't link to a patient then
                        //the resurceList is empty. Otherwise populate it with the existing resources of that type for the patient

                        if (scope.selectedReferenceResourceType.reference) {
                            // if (scope.allResourceTypesIndexedByType[resourceType].reference) {
                           // delete scope.resourceList;
                        } else {
                            //the list of resources of this type linked to this patient that can be selected...
                            scope.resourceList = RenderProfileSvc.getResourcesSelectListOfType(
                                allResources,resourceType);
                        }

                    }

                    break;
                case 'date' :
                    //results.date_start = "";
                    break;
                case 'string' :
                    //results.string = "";
                    break;



                case 'Coding' :
                    //returns the Url of the reference.
                    var valueSetReference = RenderProfileSvc.getUniqueResources(element);

                    results.coding = null;
                    if (valueSetReference) {
                        Utilities.getValueSetIdFromRegistry(valueSetReference.reference,

                            function (vsDetails) {

                                scope.vsDetails = vsDetails;
                            });
                        scope.vsReference = valueSetReference.reference;
                    }
                    break;
                case 'CodeableConcept' :
                    scope.vsReference = null;
                    delete scope.valueSet;
                    if (element.binding) {

                        //get the name of the referenced valueset in the profile - eg http://hl7.org/fhir/ValueSet/condition-code
                        var valueSetReference = RenderProfileSvc.getValueSetReferenceFromBinding(element);

                        //Assuming there is a valueset...
                        if (valueSetReference) {
                            scope.showWaiting = true;
                            results.cc = "";

                            Utilities.getValueSetIdFromRegistry(valueSetReference.reference,

                                function(vsDetails){
                                    scope.vsDetails = vsDetails;

                                    //if the current registry does have a copy of the valueset, and it's a small one, then render as
                                    //a series of radio buttons.
                                    if (scope.vsDetails && scope.vsDetails.type == 'list') {
                                        //this is a list type - ie a small number, so retrieve the entire list (expanded
                                        //but not filtered) and set the appropriate scope. This will be rendered as a set of
                                        //radio buttons...
                                        scope.showWaiting = true;
                                        // delete scope.valueSet;
                                        //scope.showWaiting = true;
                                        GetDataFromServer.getExpandedValueSet(scope.vsDetails.id).then(   //get the expanded vs
                                            function(data){
                                                //get rid of the '(qualifier value)' that is in some codes...
                                                angular.forEach(data.expansion.contains,function(item){
                                                    if (item.display) {
                                                        item.display = item.display.replace('(qualifier value)',"");
                                                    }

                                                });
                                                scope.valueSet = data;
                                            }).finally(function() {
                                                scope.showWaiting = false;
                                            }
                                        )
                                    } else {
                                        scope.showWaiting = false;
                                    }


                                });

                            scope.vsReference = valueSetReference.reference;




                        }

                    }
                    break;
                case 'code' :
                    delete scope.valueSet;
                    delete scope.vsReference;
                    if (element.binding) {
                        //retrieve the reference to the ValueSet
                        var valueSetReference = RenderProfileSvc.getValueSetReferenceFromBinding(element);



                        if (valueSetReference) {

                            //get the id of the valueset on the registry server
                            Utilities.getValueSetIdFromRegistry(valueSetReference.reference,

                                function(vsDetails){
                                    scope.vsDetails = vsDetails;

                                    if (vsDetails) {
                                        scope.showWaiting = true;
                                        //get the expansion...
                                        GetDataFromServer.getExpandedValueSet(vsDetails.id).then(
                                            function(vs){
                                                //and if the expansion worked, we're in business...
                                                if (vs.expansion) {
                                                    scope.vsExpansion = vs.expansion.contains;
                                                }


                                            }
                                        ).finally(function(){
                                            scope.showWaiting = false;
                                        });
                                    }

                                });


                            scope.vsReference = valueSetReference.reference;

                        }
                    }
                    break;
            }



        },
        cleanResource : function(treeData) {
            //remove all the elements that are of type BackboneElement but have no references to them.
            //these are elements that should be empty in the constructed resource
            var arParents =[];   //this will be all elementid's that are referenced by something
            var newArray = [];      //this will be the cleaned array
            var objId = {'#':'x'}; //all the ID's - the id of '#' is baked in...
            //construct an object of Id's
            treeData.forEach(function(item){
                objId[item.id] = 'x';
            });

            //build up a list of parents. Assume that the item that is the parent will be before the child referencing it...
            treeData.forEach(function(item){
                var parent = item.parent;
                if (arParents.indexOf(parent) == -1){       //not already in the array...
                    if (objId[parent]) {                    //and the parent does actually exist...
                        arParents.push(parent);
                    }
                }
            });



            //now find elements of type bbe

            treeData.forEach(function(item){
                if (item.isBbe){
                    //if (item.type == 'bbe'){
                    var id = item.id;
                    //if the id is not in the parent array, that means that there are no child elements referencing them so don't add
                    if (arParents.indexOf(id) > -1) {
                        newArray.push(item);
                    }
                } else {
                    //if a normal element, then make sure the parent is in the parents array. If not, don't include in the new array. This covers removing a parent
                    var parent = item.parent;
                    if (arParents.indexOf(parent) > -1){
                        newArray.push(item);
                    }
                }

            });


            return newArray;

        },
        parkResource : function(vo) {
            $localStorage.parkedResources = $localStorage.parkedResources || [];
            $localStorage.parkedResources.push(angular.copy(vo));

        },
        getParkedResources : function() {
            if ($localStorage.parkedResources) {
                return $localStorage.parkedResources;
            } else {
                return []
            }

        },
        removeParkedResource : function(inx) {
            $localStorage.parkedResources.splice(inx,1)
        },
        getConformanceResource :function(baseUrl) {
            var url = baseUrl + "metadata";
            return $http.get(url,{timeout:10000});
        },
        getConformanceResourceFromUrl :function(url) {
           
            return $http.get(url,{timeout:10000});
        },
        executeQuery : function(verb,qry) {
            switch (verb) {
                case 'GET' :
                    return $http.get(qry);
            }
        },
        addToQueryHistory : function(hx) {
            $localStorage.queryHistory = $localStorage.queryHistory || []

            var duplicate = false;
            for (var i=0; i < $localStorage.queryHistory.length; i++) {
                var item = $localStorage.queryHistory[i];
                if (item.verb == hx.verb && item.type == hx.type && item.parameters == hx.parameters && item.id == hx.id) {
                    duplicate = true;
                    break;
                }
            }

            if (! duplicate) {
                $localStorage.queryHistory.push(hx);
            }
            return $localStorage.queryHistory;
        },
        getProfileDisplay : function(url) {
            //return a collection of elements suitable for a profile summary display..
            //the url is a real reference to the profile location (not the SD.url property)
            var deferred = $q.defer();
            var that = this;




            //todo some profiles seem to have a url like http://hl7.org/fhir/profiles/MedicationDispense
           // uri = uri.replace('/profiles/','/StructureDefinition/');

            //console.log(url)
            
            

            GetDataFromServer.getConformanceResourceByUrl(url).then(
                function(profile) {
                    var lst = that.makeProfileDisplayFromProfile;
                    deferred.resolve({lst:lst,profile:profile})
                }, function (err) {
                    //alert(angular.toJson(err));
                    deferred.reject();
                }
            );



            return deferred.promise;
        },
        makeProfileDisplayFromProfile : function(inProfile) {

            var profile = angular.copy(inProfile);      //w emuck around a bit with the profile, so use a copy
            //console.log(profile);
            var arDisabled = [];          //this is a list of disabled items...
            var lst = [];           //this will be a list of elements in the profile to show.
            var elementsToDisable = ['id', 'meta', 'implicitRules', 'language', 'text', 'contained'];
            var dataTypes = ['CodeableConcept', 'Identifier', 'Period', 'Quantity', 'Reference','HumanName'];
            if (profile && profile.snapshot && profile.snapshot.element) {

                profile.snapshot.element.forEach(function (item) {
                    item.myMeta = {};

                    var el = {path: item.path};
                    var path = item.path;

                    //if max is 0, this path - and all children - are disabled in this profile...
                    if (item.max == 0) {
                        arDisabled.push(path)
                    }



                    //now see if this path has been disabled. There will be more elegant ways of doing this
                    var disabled = false;
                    for (var i = 0; i < arDisabled.length; i++) {
                        var d = arDisabled[i];
                        if (path.substr(0, d.length) == d) {
                            disabled = true;
                            break;
                        }
                    }

                    var ar = path.split('.');
                    if (ar.length == 1) {
                        disabled = true;
                    }      //don't include the domain resource

                    //standard element names like 'text' or 'language'
                    if (ar.length == 2 && elementsToDisable.indexOf(ar[1]) > -1) {
                        disabled = true;
                    }


                    //hide the extension. Will need to figure out how to display 'real' extensions
                    if (ar[ar.length - 1] == 'modifierExtension') {
                        disabled = true;
                    }

                    if (!disabled && ar[ar.length - 1] == 'extension') {
                        disabled = true;    //by default extensions are disabled...
                        //if the extension has a profile type then include it, otherwise not...

                        //console.log('ext ',item)
                        if (item.type) {
                            item.type.forEach(function (it) {
                                if (it.code == 'Extension' && it.profile) {
                                    disabled = false;
                                    //load the extension definition to

                                    //use the name rather than 'Extension'...
                                    ar[ar.length - 1] = "*"+ item.name;
                                }
                            })
                        }
                    }

                    ar.shift();     //removes the type name at the beginning of the path

                    item.myMeta.path = ar.join('. ');     //create a path that doesn't include the type (so is shorter)

                    //make references look nicer. todo - what about references to profiles?
                    if (item.type) {
                        item.type.forEach(function (it) {
                            if (it.code == 'Reference') {
                                if (it.profile) {
                                    var p = it.profile[0];      //todo  <<<<<<<<<<<<<<<<<<
                                    var ar = p.split('/');
                                    it.code = '->' + ar[ar.length - 1];
                                }
                            }
                        })
                    }


                    if (!disabled) {
                        lst.push(item);
                    }


                    //if the type is a recognized datatype, then hide all child nodes todo - won't show profiled datatyoes
                    //note that this check is after it has been added to the list...
                    if (item.type) {
                        item.type.forEach(function (type) {
                            if (dataTypes.indexOf(type.code) > -1) {
                                arDisabled.push(path)
                            }
                        });
                    }


                });

            }

            return lst;

        },
        createConformanceQualityReport : function(conf){
            //create a quality report (list of issues) for a conformance resource
            var lstIssue = [];
            var deferred = $q.defer();
            //console.log(conf)

            var arQueryProfiles = []; //a list of queries - ie referenced profiles
            var arProfiles = [];    //a list of the profiles that have been retrieved...
            var arExtensions = [];      //a list of all the extensions references by profiles in the conformance resource
            var arQueryExtensions = [];  //queries to check the existance of all extension definitions...
            conf.rest[0].resource.forEach(function(res){
                //console.log(res);
                if (!res.profile) {
                    lstIssue.push({level:"warning",display:"The "+res.type + ' type does not have a profile element'})
                } else {
                    var profileUrl = res.profile.reference;
                    if (!profileUrl) {
                        lstIssue.push({level:"warning",display:"The "+res.type + ' type has a profile element, but no reference'})
                    } else {
                        //now check that the reference exists
                        arQueryProfiles.push(getProfile(res,profileUrl));
                    }
                }
            });



            function getExtension(res,extensionUrl){
                //function to load an extension and save it in an array
                var deferred = $q.defer();
                GetDataFromServer.findConformanceResourceByUri(extensionUrl).then(
                    function(extensionDefinition){
                        arExtensions.push({url:extensionUrl,ed:extensionDefinition});    //this the uri for an extension
                    },
                    function(err){
                        lstIssue.push({level:"error",display:"The "+res.type + ' type has a reference to an extension of '+extensionUrl + " which can't be loaded"})
                    }
                ).finally(function(){
                    deferred.resolve();
                });
                return deferred.promise;
            }

            //function to load a profile, then save it in an array. Also generate a list of the extensions and valuesets referenced by that profile
            function getProfile(res,profileUrl) {
                var deferred = $q.defer();
                GetDataFromServer.findConformanceResourceByUri(profileUrl).then(
                    function(profile) {
                        arProfiles.push(profile);
                        //now find all extensions referred by the profile
                        if (profile && profile.snapshot) {
                            profile.snapshot.element.forEach(function(element){
                                if (element.path.indexOf('extension')){
                                    if (element.type) {
                                        element.type.forEach(function (it) {
                                            if (it.code == 'Extension' && it.profile) {
                                                it.profile.forEach(function(uri){
                                                   // arExtensions.push({url:uri});    //this the uri for an extension
                                                    arQueryExtensions.push(getExtension(res,uri));      //a function that will check that an extension exists

                                                })

                                            }
                                        })
                                    }
                                }

                            })
                        }


                    },
                    function(err) {
                        lstIssue.push({level:"error",display:"The "+res.type + ' type has a profile reference of '+profileUrl + " which can't be loaded"})
                    }
                ).finally(function(){
                    deferred.resolve();
                });
                return deferred.promise;
            }

            //retrieve all the referenced profiles. Mark an error if one can't be found.
            //for each profile returned, look for extensions and valuesets - we'll check those as well...
            $q.all(arQueryProfiles).then(
                //regardless of success or failure, turn off the saving flag
                function() {
                    //console.log('profiles',arProfiles);     //this will be a collection of all profiles
                    //console.log(lstIssue)

                    //so we've checked all the references from conformance -> profile, now to check the extensions
                    arQueryExtensions
                    $q.all(arQueryProfiles).then(
                        function(){
                            deferred.resolve({issues:lstIssue,profiles:arProfiles,extensions:arExtensions});
                        },
                        function(err) {
                            console.log('error in $q.all reading extensions...')
                        }
                    )



                },
                function(err) {
                    console.log('error in $q.all reading profiles...')
                }
            );



            return deferred.promise;
            
        },

        createProfileTreeDisplay : function(profile,showRemoved){
            //create a clone of the profile suitable for display...
            var simpleDT = ['string','instant','time','date','dateTime','decimal','boolean','integer','base6Binary','uri','unsignedInt','positiveInt','code','id','oid','markdown'];


            var that = this;
            //var slicedExtensions = {};
            var displayProfile = [];

            if (profile && profile.snapshot && profile.snapshot.element) {

                profile.snapshot.element.forEach(function (element) {
                    //var display = {type:[],name:element.name};
                    var display = angular.copy(element);
                    display.myStuff = {};
                    //display.path =  element.path;//.replace(/\./g, ". ")
                    var path = element.path;
                    var ar = path.split('.');
                    display.myStuff.name = display.name;
                    if (!display.myStuff.name) {
                        display.myStuff.name = ar[ar.length - 1]
                    }

                    //add a space to any dots to allow the display to break...  (QIcode medication )
                    display.myStuff.name = display.myStuff.name.replace(/\./g, " \.");

                    if (display.myStuff.name == 'extension' && element.short) {
                        display.myStuff.name = element.short;
                    }

                    if (display.myStuff.name.length > 50) {
                        display.myStuff.name = display.myStuff.name.substr(0, 47) + '...';
                    }

                    if (element.max == '*') {
                        display.myStuff.multiplicity = '*'
                    } else {
                        display.myStuff.multiplicity = ' '
                    }

                    //display.myStuff.multiplicity = element.min + '..' + element.max;


                    //set the indenting...
                    var spacer = "";
                    for (var i = 0; i < ar.length; i++) {
                        spacer += "&nbsp;&nbsp;&nbsp;&nbsp;";
                    }

                    display.myStuff.spacer = $sce.trustAsHtml(spacer);


                    var include = true;         //default is to include an element

                    //generate the discriminators based on path...

                    if (ar[ar.length - 1].indexOf('xtension') > -1) {
                        display.myStuff.isExtension = true;
                        //   if (! slicedExtensions[path]) {
                        //     slicedExtensions[path] = [];
                        //   }
                        //if it has a type with an extension, then add the element to the list of sliced elements. Assume url as the discriminator...
                        if (element.type) {
                            element.type.forEach(function (typ) {
                                //console.log(typ )

                                if (typ.profile) {
                                    //only use the first profilefor now
                                    //var profile = typ.profile[0].replace("http://hl7.org/fhir/StructureDefinition/","");
                                    var profileUrl = typ.profile[0];

                                    //console.log(profileUrl)
                                    //process Extension
                                    GetDataFromServer.findConformanceResourceByUri(profileUrl).then(
                                        //GetDataFromServer.findResourceByUrlPromise('StructureDefinition', profileUrl).then(
                                        function (data) {
                                            var analysis = Utilities.analyseExtensionDefinition(data);
                                            //console.log(analysis)
                                            if (analysis.isCoded) {
                                                display.myStuff.isCoded = true;
                                            }
                                            display.myStuff.extensionAnalysis = analysis;

                                            //if there's a referenceTypes property then this extension references another...
                                            if (analysis.referenceTypes) {
                                                //this is for the summary display...
                                                display.myStuff.dataTypeIcon = "icon_reference.png";
                                                display.myStuff.dataTypeDescription = "This is reference to another resource";
                                                //and this for the detail....
                                                display.myStuff.isReference = true;


                                            }


                                        },
                                        function (err) {
                                            console.log('error getting SD', err)
                                        }
                                    );


                                    //  slicedExtensions[path].push(profile);
                                    display.myStuff.notePoint = path + profileUrl;
                                    display.myStuff.notePoint = display.myStuff.notePoint.replace(/\./g, "_");

                                } else {
                                    //don't include if there is no profile to the extension
                                    include = false;
                                }


                                display.type.push(typ)
                            });
                        } else {
                            //don't include if no type...
                            include = false;

                        }
                    } else {
                        //for non extensions, the point that notes can be attached is the path...
                        display.myStuff.notePoint = path.replace(/\./g, "_");
                    }

                    //look for fixed values. is there a property that starts with 'fixed'?
                    angular.forEach(element, function (value, key) {    //iterate through all the properties...
                        if (key.substr(0, 5) == 'fixed') {
                            //console.log(key,value)
                            display.myStuff.fixed = value;
                            display.myStuff.fixedType = key;
                        }

                    });

                    //look for coded values - is there a binding element
                    if (element.binding) {
                        display.myStuff.isCoded = true;
                    }

                    //get the permissable types
                    if (element.type) {
                        display.myStuff.type = "";
                        element.type.forEach(function (typ) {
                            display.myStuff.type += ', ' + typ.code
                        });

                        display.myStuff.type = display.myStuff.type.substr(2);

                        //create a datatype icon based on the first element in the type
                        display.myStuff.dataTypeIcon = "icon_datatype.gif";
                        display.myStuff.dataTypeDescription = "This is a complex datatype";
                        var code = element.type[0].code;
                        if (simpleDT.indexOf(code) > -1) {
                            display.myStuff.dataTypeIcon = "icon_primitive.png";
                            display.myStuff.dataTypeDescription = "This is a primitive datatype"
                        } else if (code == 'Extension') {
                            //display.myStuff.dataTypeIcon= "icon_extension_simple.png";
                            //display.myStuff.dataTypeDescription = "This was added by an extension"
                            display.myStuff.isSimpleExtension = true;// "icon_extension_simple.png";


                        } else if (code == 'Reference') {
                            display.myStuff.dataTypeIcon = "icon_reference.png";
                            display.myStuff.dataTypeDescription = "This is reference to another resource";
                            display.myStuff.isReference = true;
                            //now create a display for the references...
                            display.myStuff.references = [] || display.myStuff.references;

                            //create an array of all the resources referenced..
                            element.type.forEach(function (typ) {
                                if (typ.profile) {
                                    typ.profile.forEach(function (url) {
                                        var details = {url: url};
                                        var ar = url.split('/');
                                        details.display = ar[ar.length - 1];
                                        details.specification = "http://hl7.org/fhir/" + details.display;
                                        display.myStuff.references.push(details);
                                    })
                                }


                            });


                        } else if (code == 'BackboneElement') {
                            delete display.myStuff.dataTypeIcon;//= "icon_reference.png";
                        }

                    }


                    //remove the 'standard' path elements...
                    var arIntersection = ar.filter(function (n) {
                        return ['meta', 'id', 'implicitRules', 'text', 'contained', 'language'].indexOf(n) != -1
                    });
                    if (arIntersection.length > 0) {
                        include = false
                    }

                    //if showRemoved is false then don't display elements that are marked as removed (max = '0')
                    if (!showRemoved) {
                        if (element.max == '0') {
                            include = false;
                        }
                    }

                    if (include) {
                        displayProfile.push(display)
                    }

                });
            }

            return displayProfile;
        }

    }

});