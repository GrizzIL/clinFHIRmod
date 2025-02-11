angular.module("sampleApp")
    .controller('taskViewerCtrl',
        function ($scope,$http,v2ToFhirSvc,$timeout,taskViewerSvc, $localStorage) {

            $scope.input = {}
            $scope.taskViewerSvc = taskViewerSvc
            $scope.moment = moment;

            $scope.state = 'view';
            //possible states: view, newtask, viewlog

            //$scope.thisUserId = $localStorage.pcUserId || "Organization/cmdhb"

/*
            function getAllTasks() {
                let url = "/ctAllTasks"
                $scope.showWaiting = true;
                $http.get(url).then(
                    function(data) {
                        console.log(data.data)
                        $scope.bundleTasks = {resourceType:'Bundle',entry:[]}
                        $scope.completedTasks = {resourceType:'Bundle',entry:[]}
                        data.data.entry.forEach(function (entry) {
                            if (entry.resource.status == 'completed') {
                                $scope.completedTasks.entry.push(entry)
                            } else {
                                $scope.bundleTasks.entry.push(entry)
                            }
                        })
                    }
                ).finally(
                    function () {
                        $scope.showWaiting = false;
                    }
                )
            }

            getAllTasks();
        */

            //will be a list of all patients for whom there is an active task
            $scope.allPatients = []

            function getActiveTasks() {
                let url = "/ctOpenTasks"
                $http.get(url).then(
                    function(data) {
                        console.log(data.data)
                        $scope.bundleTasks = {entry:[]} //todo - make this a simple list...
                        data.data.entry.forEach(function (entry) {
                            if (entry.resource.resourceType == 'Task') {
                                $scope.bundleTasks.entry.push(entry)
                            } else {
                                let patient = entry.resource
                                let display = "Id=" + patient.id
                                if (patient.name) {
                                    display = ""
                                    if (patient.name[0].given) {
                                        display += patient.name[0].given[0]
                                    }
                                    display += " " + patient.name[0].family + " (Id:" + patient.id + ")"
                                     //display = patient.name[0].familypatient.name[0].family
                                }

                                //used for patient perspective...
                                $scope.allPatients.push({resource:patient,display:display,ref:'Patient/'+patient.id})
                            }
                            //$scope.bundleTasks = data.data
                        })
                        $scope.$broadcast('patsLoaded', { });



                        //get the list of patients


                    }
                )
            }
            getActiveTasks()

            function getCompletedTasks() {
                let url = "/ctCompletedTasks"
                $http.get(url).then(
                    function(data) {
                        console.log(data.data)
                        $scope.completedTasks = data.data
                    }
                )

            }
            getCompletedTasks()

            //Get the organizations that can receive correction requests
            $http.get("/ctOrganizations").then(
                function(data) {
                    console.log(data.data)
                    $scope.organizations = []
                    if (data.data.entry && data.data.entry.length > 0) {
                        data.data.entry.forEach(function (entry) {
                            $scope.organizations.push(entry.resource)
                        })
                        $scope.selectedOrganization = $scope.organizations[0]

                        $scope.$broadcast('orgsLoaded', { });


                    } else {
                        alert("There are no organizations configured to receive correction requests")
                    }
                    //$scope.organizations = data.data

                }
            )
            $scope.selectOrganization = function (org){
                $scope.selectedOrganization = org
            }


            $scope.getTaskHistory = function(task) {
                delete $scope.selectedTaskVersionCommunication;
                let qry = "/fhir/Task/" + task.id + "/_history"
                $scope.showWaiting = true;
                $http.get(qry).then(
                    function(data) {
                        $scope.taskHistory = data.data;

                    }, function(err) {
                        alert(angular.toJson(err.data))
                    }
                ).finally(function(){
                    $scope.showWaiting = false
                })
            }

            $scope.selectTaskVersion = function(entry) {
                delete $scope.selectedTaskVersionCommunication;
                $scope.selectedTaskVersion = entry.resource;    //the Task resource


                //now go look for the Communication that it is the focus of
                //Note that the input isn't right as it is the original Comm
                if ($scope.selectedTaskVersion.focus) {
                    let commId = $scope.selectedTaskVersion.focus.reference
                    let ar = commId.split('/')
                    $scope.allResourcesForRequest.forEach(function (resource) {
                        if (resource.id == ar[1]) {
                            $scope.selectedTaskVersionCommunication = resource;
                        }
                    })
                }

                //selectedTaskVersionCommunication

            }

            /*

            $scope.newTask = function () {
                $scope.state = "newtask"
            }

            //create the new task and a communication
            $scope.addTask = function () {
                //create a Communication and POST it to this endpoint (will create the Task as well)
                //'from' the patient

                let bundle = {resourceType:'Bundle','type':'collection',entry:[]}

                //add patient resurce
                let patient = {resourceType:'Patient'}
                patient.id = uuidv4();
                patient.name = [{family:$scope.input.patientLName,given:[$scope.input.patientFName]}]
                if ($scope.input.patientIdentifier) {
                    patient.identifier = [$scope.input.patientIdentifier]
                }

                bundle.entry.push({resource:patient})

                let description = $scope.input.description;
                let communication = {resourceType:'Communication'}


                let text = "<div xmlns='http://www.w3.org/1999/xhtml'>Initial request</div>"
                communication.text = {div:text}

                communication.status = "completed"
                communication.category = {coding:[{system:"http://hl7.org/fhir/uv/patient-corrections/CodeSystem/PatientCorrectionTaskTypes",code:"medRecCxReq"}]}
                communication.recipient = {reference:"Organization/" + $scope.selectedOrganization.id}
                communication.subject = {reference:"Patient/"+patient.id }
                communication.sender = {reference:"Patient/"+patient.id }
                communication.reasonCode = {coding:[{system:"http://hl7.org/fhir/uv/patient-corrections/CodeSystem/PatientCorrectionTaskTypes",code:"medRecCxReq"}]}
                communication.payload = [{contentString:description}]
                bundle.entry.push({resource:communication})


                $http.post('/fhir/Communication/$process-medRecCxReq',bundle).then(
                    function() {
                        getActiveTasks()
                        alert("saved!")

                    }, function(err) {
                        alert(angular.toJson( err.data))
                    }
                )

                function uuidv4() {
                    //https://intellipaat.com/community/22734/create-guid-uuid-in-javascript
                    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
                        return v.toString(16);

                    });

                }

            }


            */

            //A resource has been selected in the correction set
            $scope.selectResource = function (resource) {
                $scope.selectedResource = resource;
            }

            //A task has been selected in the list to the left. Get all the communications that
            $scope.selectPrimaryTask = function(task,cb) {
                $scope.state = 'view';

                $scope.primaryTask = task
                $scope.allResourcesForRequest = []

                delete $scope.primaryCommunication;
                delete $scope.selectedResource;
                delete $scope.selectedTaskVersion;
                delete $scope.selectedTaskVersionCommunication;
                delete $scope.taskHistory
                delete $scope.ehrSelectedPatient


                //Get the patient as a separate request. Could be a better way...
                if (task.for && task.for.reference) {
                    let ref = task.for.reference;
                    let ar = ref.split('/')
                    let qry = "/proxy/Patient/"+ ar[ar.length-1]  //the id
                    $http.get(qry).then(
                        function(data) {
                            $scope.ehrSelectedPatient = data.data
                        },
                        function(err) {
                            console.log(err)
                        }

                    )
                }


                //get the Primary communication (has an 'input' link)
                //todo - assume only a single input for now. May need to iterate through the array looking for Commmu
                let communicationId;
                if (task.input && task.input.length > 0) {
                    task.input.forEach(function (inp) {
                        if (inp.valueReference && inp.valueReference.reference) {
                            if (inp.valueReference.reference.indexOf("Comm") > -1) {
                                communicationId = inp.valueReference.reference;     //eg Communication/{id}
                            }
                        }
                    })
                }

                if (communicationId) {
                    //we have the id of the primary communicatoion, so retrieve it
                    $scope.showWaiting = true;

                    let url = "/fhir/" + communicationId        //note communicationId includes the type...
                    $http.get(url).then(
                        function (data) {
                            $scope.primaryCommunication = data.data

                            //Don't add here - it gets added in the 'about' call
                            // = not when using the 'real' about query!
                            $scope.allResourcesForRequest.push(data.data)

                            //now get the other Communication resources with an 'about' reference to the primary one
                            //nested so know when to draw the graph - todo more performant options are possible

                            let ar = communicationId.split('/');        //split the id from the resource type
                            url = "/fhir/Communication?about=" + ar[1];

                            $http.get(url).then(
                                function (data) {
                                    $scope.showWaiting = false;
                                    console.log(data.data)
                                    let hash = {}
                                    if (data.data.entry) {      //A Bundle is returned
                                        //add each resource to the


                                        //order the communications so the reply is below the request


                                        //first populate the hash with coms that are not responses
                                        data.data.entry.forEach(function (entry) {
                                            let com = entry.resource
                                            //either inResponse is empty or an empty array
                                            if (! com.inResponseTo || (com.inResponseTo && com.inResponseTo.length == 0)) {
                                                hash['Communication/' + com.id] = {rfi:com}
                                            }
                                        })

                                        //now, add the responses to those rfi
                                        data.data.entry.forEach(function (entry) {
                                            let com = entry.resource
                                            if (com.inResponseTo && com.inResponseTo.length > 0) {
                                                //first irt
                                                let rfiComId = com.inResponseTo[0].reference       //eg Communication/{id}
                                                if (hash[rfiComId]) {
                                                    //there could be multiple replies...
                                                    hash[rfiComId].reply = hash[rfiComId].reply || []
                                                    hash[rfiComId].reply.push(com)
                                                } else {
                                                    console.log(rfiComId + ' not in hash')
                                                    //hmm suggests an error if the rfi is not present. Add it to the hash so it will go in the list
                                                    hash[rfiComId] = {rfi:com}
                                                }

                                                //hash[com.id] = {rfi:com}
                                            }
                                        })
                                    }


                                    //convert the hash into an array for display
                                    Object.keys(hash).forEach(function (key) {
                                        let rfi = hash[key].rfi
                                        $scope.allResourcesForRequest.push(rfi)
                                        if (hash[key].reply) {
                                            hash[key].reply.forEach(function (reply){
                                                //reply.isReply = true    //todo move to meta
                                                $scope.allResourcesForRequest.push(reply)
                                            })
                                        }

                                    })


                                    //$scope.hashCommunications = hash
                                    //copy to $scope.allResourcesForRequest

                                    //make pseudo=bundle for graph
                                    let bundle = {entry:[]}
                                    $scope.allResourcesForRequest.forEach(function (resource) {
                                        bundle.entry.push({resource:resource})
                                    })

                                    let options = {bundle:bundle,hashErrors:{},serverRoot:""}

                                    drawGraph(options)
                                    //used in patient tab to return the list of matching resources...
                                    if (cb) {
                                        cb($scope.allResourcesForRequest)
                                    }

                                }, function(err) {

                                })

                        },
                        function(err) {
                            alert(angular.toJson(err))
                        }
                    )
                }
                $scope.allResourcesForRequest.push(task)    //have the task second...

            }


            //add a communication that has a link to the primary one...
            $scope.requestInfoDEP = function() {
                let comment = prompt("What do you want to say?")
                if (comment) {
                    //construct a Communication with an 'about' link to the primary one...
                    //the server will add the 'sent' element - so tz consistent across users...
                    let bundle = {resourceType:'Bundle','type':'collection',entry:[]}

                    let communication = {resourceType:'Communication'}
                    communication.inResponseTo = [{reference:"Communication/"+$scope.primaryCommunication.id}]
                    communication.status = "completed"
                    communication.category = {coding:[{system:"http://hl7.org/fhir/uv/patient-corrections/CodeSystem/PatientCorrectionTaskTypes",code:"medRecCxReq"}]}
                    communication.about = [{reference:"Communication/"+$scope.primaryCommunication.id }]
                    communication.subject = $scope.primaryCommunication.subject
                    communication.recipient = [$scope.primaryCommunication.subject]
                    communication.sender = {reference:"Organization/" + $scope.selectedOrganization.id }  //the UI user
                    communication.reasonCode = {coding:[{system:"http://hl7.org/fhir/uv/patient-corrections/CodeSystem/PatientCorrectionTaskTypes",code:"medRecCxReq"}]}
                    communication.payload = [{contentString:comment}]
                    bundle.entry.push({resource:communication})

                    $http.post('/fhir/Communication/$process-medRecCxReq',bundle).then(
                        function(data) {
                            //let updatedCommunication = data.data   //the communication is returned
                            $scope.selectPrimaryTask($scope.primaryTask);
                            alert("The Communication has been saved, and the Task updated.")

                        }, function(err) {
                            alert(angular.toJson("Error creating Communication " + angular.toJson(err.data)))
                        }
                    )
                }
            }

            //enter a response from a patient to a request for more info
            $scope.respondToRequestInfo = function(communicationToRespondTo) {

                if (! communicationToRespondTo.sender) {
                    alert("No sender found...")
                    return
                }

                let msg = "How did the patient respond?"
                let text = "<div xmlns='http://www.w3.org/1999/xhtml'>From Patient</div>"
                //look at the sender of the communication to respond to.
                if (communicationToRespondTo.sender.reference.indexOf('Patient') > -1) {
                    //the sender was the patient
                    msg = "How do you want to reply to the Patient?"
                    text = "<div xmlns='http://www.w3.org/1999/xhtml'>To Patient</div>"
                }

                let comment = prompt(msg)
                if (comment) {
                    //construct a Communication with an 'about' link to the primary one...
                    //the server will add the 'sent' element - so tz consistent across users...
                    let bundle = {resourceType:'Bundle','type':'collection',entry:[]}
                    let communication = {resourceType:'Communication'}


                    communication.text = {div:text}

                    communication.status = "completed"
                    communication.inResponseTo = [{reference:"Communication/"+communicationToRespondTo.id}]
                    communication.category = {coding:[{system:"http://hl7.org/fhir/uv/patient-corrections/CodeSystem/PatientCorrectionTaskTypes",code:"medRecCxReq"}]}
                    communication.about = [{reference:"Communication/"+$scope.primaryCommunication.id }]
                    communication.subject = $scope.primaryCommunication.subject

                    //The revipient of this comm is the sender of the one being replied to...
                    communication.recipient = [communicationToRespondTo.sender] //  [{reference:$scope.thisUserId }]

                    //The sender of this comm is the recipient of the one being replied to...
                    communication.sender = communicationToRespondTo.recipient[0]; //$scope.primaryCommunication.subject  //the UI user
                    communication.reasonCode = {coding:[{system:"http://hl7.org/fhir/uv/patient-corrections/CodeSystem/PatientCorrectionTaskTypes",code:"medRecCxReq"}]}
                    communication.payload = [{contentString:comment}]

                    bundle.entry.push({resource:communication})

                    $http.post('/fhir/Communication/$process-medRecCxReq',bundle).then(
                        function(data) {
                            $scope.selectPrimaryTask($scope.primaryTask);
                            alert("The Communication has been saved, and the Task updated.")
                            //todo - move this Task update to the API



                        }, function(err) {
                            alert(angular.toJson( err.data))
                        }
                    )

                }
            }


            //close the task
            $scope.closeRequest = function() {
                let comment = prompt("What is the closing message?")
                if (comment) {
                    //construct a Communication with an 'about' link to the primary one...
                    //the server will add the 'sent' element - so tz consistent across users...

                    let communication = {resourceType:'Communication'}
                    let text = "<div xmlns='http://www.w3.org/1999/xhtml'>From Patient</div>"
                    communication.text = {div:text}

                    communication.status = "completed"
                    communication.category = {coding:[{system:"http://hl7.org/fhir/uv/patient-corrections/CodeSystem/PatientCorrectionTaskTypes",code:"medRecCxReq"}]}
                    communication.about = [{reference:"Communication/"+$scope.primaryCommunication.id }]
                    communication.subject = $scope.primaryCommunication.subject
                    communication.recipient = $scope.primaryCommunication.subject
                    communication.sender = {reference : "Organization/" + $scope.selectedOrganization.id} //the UI user
                    communication.reasonCode = {coding:[{system:"http://hl7.org/fhir/uv/patient-corrections/CodeSystem/PatientCorrectionTaskTypes",code:"medRecCxReq"}]}
                    communication.payload = [{contentString:comment}]
                    let bundle = {resourceType:'Bundle','type':'collection',entry:[]}
                    bundle.entry.push({resource:communication})

                    $http.post('/fhir/Communication/$process-medRecCxReq',bundle).then(
                        function(data) {
                            let updatedCommunication = data.data   //the communication is returned
                            let clone = angular.copy($scope.primaryTask)
                            delete clone.owner;     //no one owns the task any more
                            //clone.owner = {reference:$scope.thisUserId};        //change the owner to this user
                            clone.status = "completed"
                            // the communication
                            clone.focus = {reference : "Communication/"+ updatedCommunication.id}
                            updateTask(clone,function(){
                                $scope.selectPrimaryTask($scope.primaryTask);
                                getActiveTasks();
                                alert("The Communication has been saved, and the Task status set to 'completed'.")
                            })

                        }, function(err) {
                            alert(angular.toJson( err.data))
                        }
                    )
                }
            }

            function updateTask(clone,cb){
                $http.put('/fhir/Task/'+ clone.id,clone).then(
                    function (data){
                        console.log(data)
                        $scope.primaryTask = data.data;     //The updated Task is returned by the server
                        for (let i=0; i < $scope.bundleTasks.entry.length; i++) {
                            if ($scope.bundleTasks.entry[i].resource.id == clone.id) {
                                $scope.bundleTasks.entry[i].resource = data.data;
                                break;
                            }
                        }
                        cb()
                       // $scope.selectPrimaryTask($scope.primaryTask);
                        //alert("The Communication has been saved, and the Task updated.")
                    },
                    function (err){
                        alert(angular.toJson("Error creating Task " + err.data))
                    }
                )
            }

            //---------- Graph functions

            function drawGraph(options) {
                console.log(options)
                let vo = v2ToFhirSvc.makeGraph(options)
                console.log(vo)

                var container = document.getElementById('graph');
                var graphOptions = {
                    physics: {
                        enabled: true,
                        barnesHut: {
                            gravitationalConstant: -10000,
                        }
                    }
                };
                $scope.chart = new vis.Network(container, vo.graphData, graphOptions);

                $scope.chart.on("click", function (obj) {

                    var nodeId = obj.nodes[0];  //get the first node
                    var node = vo.graphData.nodes.get(nodeId);

                    if (node.entry) {
                        $scope.selectedResource = node.entry.resource;
                    }


                    //this is the entry that is selected from the 'bundle entries' tab...
                    //$scope.selectedBundleEntry = node.entry;

                    $scope.$digest();
                });
            }

            $scope.fitGraph = function(){
                $timeout(function(){
                    if ($scope.chart) {
                        $scope.chart.fit();
                    }
                },1000)
            };

            //============ log functions

            $scope.showLog = function() {
                $scope.loadLog()
                $scope.state='viewlog'
            }


            $scope.loadLog = function() {
                $scope.showWaiting = true;
                $http.get('/manage/getLog').then(
                    function(data) {
                        //all log entries
                        let hash = {}
                        data.data.forEach(function (log) {
                            hash[log.corrId] = hash[log.corrId] || {}
                            let item = hash[log.corrId]
                            if (log.status) {
                                //this is the log of the bundle sent to the server (ie this is the one with the status)
                                item.status = log.status;
                                item.toServer = log.resource
                            } else {
                                //this is the initial request
                                item.url = log.url
                                item.date = log.date
                                item.fromClient = log.resource

                                //locate the Communication resource in the bundle (if it exists). Add the identifier to the display
                                if (log.resource.entry) {
                                    log.resource.entry.forEach(function (entry) {
                                        if (entry.resource && entry.resource.resourceType == 'Communication') {
                                            item.communication = entry.resource;
                                        }
                                    })
                                }

                            }
                        })
                        $scope.apiLog = []
                        Object.keys(hash).forEach(function (key) {
                            let item = hash[key];

                            $scope.apiLog.push(item)
                        })


                }).finally(function () {
                    $scope.showWaiting = false;
                })
            }

            $scope.selectLogItem = function(log){
                $scope.selectedLogItem = log;

                //make the download link

                $scope.downloadLinkJsonContent = window.URL.createObjectURL(new Blob([angular.toJson(log.fromClient)],
                    {type: "application/json"}));

                //$scope.downloadLinkJsonName = "downloaded"
                var now = moment().format();
                $scope.downloadLinkJsonName = 'log-' + now + '.json';

            }

        }
    )