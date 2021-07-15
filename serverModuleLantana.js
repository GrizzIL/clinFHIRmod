let Fhir = require('fhir').Fhir;


function setup(app) {


    app.post("/transformJson",function (req,res){
        //transform from Xml to Json
        let body= "";
        req.on('data', function (data) {
            body += data;
        });

        req.on('end', function () {
            console.log(body)
            const fhir = new Fhir();
            try {
                console.log('b4')
                let json = fhir.xmlToObj(body);
                console.log('aft')
                res.send(json)
            } catch (ex) {
                console.log(ex)
                res.status(500).send({message:"Unable to convert to Json." + ex.message})
            }

        })
    })


// ---------- for the server query - to strt with
    app.post("/transformXML",function (req,res){
        //transform from Json to Xml
        let body= "";
        req.on('data', function (data) {
            body += data;
        });

        req.on('end', function () {
            let resource = JSON.parse(body)
            var fhir = new Fhir();
            var xml = fhir.objToXml(resource);
            //console.log(body,xml)
            res.send(xml)
        })
    })

}

module.exports= {
    setup : setup
}