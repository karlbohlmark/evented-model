
var Company = model('Company', {
    type: 'object',
    properties: {
        name: { require: true },
        orgNr: { type: "number" }

    }
});

var User = model('User')
    .attr('firstname', {'required': true})
    .attr('email')
    .attr('employer', Company);

User.on('construct', function (instance) {

});

var user = new User({
    firstname: 'John'
});

user.on('change firstname', function (newValue) {

});

user.on('change', function (property, value) {

});
