var model = require('./')
var Emitter = require('emitter')

var companySchema = {
    "type": "object",
    "properties": {
        "name": {
            "type": "string"
        }
    }
}

var Company = model('Company', companySchema );

var User = model('User')
.attr('firstname')
.attr('email')
.attr('employers', [Company])
.attr('currentEmployer', Company)


var user = new User({
    firstname: 'John',
    employers: [{
        "name": "Connecta"
    }]
})

var onchange = user.changes()

onchange(function (patch) {
    console.log(patch)
})

user.firstname = 'Karl';

