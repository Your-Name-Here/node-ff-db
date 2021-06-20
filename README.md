# node-ff-db

## Introduction

A flat-file database abstraction wrapper.
>Please review the code before you include it in your project. I am not a security expert and didn't build any in as this is just for my projects.

Documentation is coming. 

## Code Samples

```js
var databaseName = 'TestDB';
var { Database, Schema } = require('node-ff-db');
db = new Database( { file: databaseName } );

function validateEmail(email) {
    const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(String(email).toLowerCase());
}

const usersSchema = new Schema('users')

// Add columns to the schema
usersSchema.addColumn({
    name:'id',
    required: true,
    autoIncrement: true,
    unique: true,
    type: Number
});
usersSchema.addColumn({
    name:'name',
    required: true
    type: String
});
usersSchema.addColumn({
    name:'email',
    required: true,
    type: String,
    validateFunc: validateEmail
});

db.once('ready', ()=>{
    if( db.createTable( usersSchema ) ) {    
       console.log('Users Table Created')
    }
});
```

## Installation

``npm install node-ff-db -s``