const chai = require("chai");
chai.use(require("chai-events"));
const should = chai.should();
var chaiAsPromised = require("chai-as-promised");
const fs = require('fs');


chai.use(require("chai-events"));
chai.use(chaiAsPromised);

describe('Database', async function() {
    var databaseName = 'TestDB';
    var { Database, Schema } = require('../index');
    var db;
    before(function() {        
        // runs before all tests in this file regardless where this line is defined.
        db = new Database( { file: databaseName } );
    });

    after(function() {
        // runs after all tests in this file
        fs.unlink(db.file, (err => {
            if (err) console.log(err);
            //fs.unlink(db._schemaFile, (err => {
                process.exit(0);
            //}));
        }));
        //process.exit();
        // setTimeout(()=>{
        //     fs.unlinkSync(db.file)
        //     process.exit();
        // }, 5000);
    });
    function validateEmail(email) {
        const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
        return re.test(String(email).toLowerCase());
    }
    const usersSchema = new Schema('users')
    usersSchema.addColumn({
        name:'id',
        required: true,
        autoIncrement: true,
        unique: true,
        type: Number
    });
    usersSchema.addColumn({
        name:'name',
        required: true,
        type: String
    });
    usersSchema.addColumn({
        name:'email',
        required: true,
        type: String,
        validateFunc: validateEmail
    });
    it('Database ready event', done=>{
        this.timeout(30000);
        // runs before all tests in this file regardless where this line is defined.
        db.once('ready', ()=>{
            done();
        });
    });
    it( 'Create Table', async () => {
        db.createTable( usersSchema );
        (db._data.has('users')).should.be.true;
    } );
    it('Insert Data 1: users table; Valid Data', ()=>{
        (db.insert('users', {
            name:  'Bob',
            email: 'bob@email.com'
        } )).should.have.property( 'id', 1 );
    });
    it('Insert Data 2: users table; Valid Data', ()=>{
        db.insert('users', {
            name:  'Bob',
            email: 'bob@email.com'
        } ).should.have.property( 'id', 2 );
    });
    it('Insert Data from array: users table; Valid Data', ()=>{
        ['Cody', 'Rebebak', 'Noah', 'John', 'Philis', 'Tiny'].forEach( user => {
            db.insert('users', {
                name:  user,
                email: `${ user.toLowerCase() }@email.com`
            } );
        } );
        (db.fetch('users')).should.have.a.lengthOf( 8 );
    });
    it('Insert Data: Throw error on invalid name', ()=>{
        (db.insert.bind(db, 'users', {
            name:  1,
            email: 'bob@email.com'
        } )).should.throw();
    });
    it('Insert Data: Throw error on invalid email', ()=>{
        (db.insert.bind(db, 'users', {
            name:  'Bob',
            email: 'bob.email.com'
        } )).should.throw();
    });
    it('Fetch Data: 2 Record', ()=>{
        (db.fetch( 'users', record => {
            return record.name.toLowerCase() == 'bob';
        } )).should.have.a.lengthOf(2);
    });
    it('Fetch Data: 1 Records', ()=>{
        (db.fetch( 'users', record => {
            return record.name.toLowerCase() == 'cody';
        } )).should.have.a.lengthOf(1);
    });
    it('Fetch Data by ID: 1 record', ()=>{
        const results = db.fetch( 'users', record => {
            return record.id == 3;
        } );

        (db.fetch( 'users', record => {
            return record.id == 1;
        } )).should.have.a.lengthOf(1);
    });
    it('Fetch Data using includes: 8 records', ()=>{
        const results = db.fetch( 'users', record => {
            return record.email.includes('email.com');
        } );

        (results).should.have.a.lengthOf(8);
    });
    it('Update record with invalid data should throw', ()=>{
        
        (db.update.bind(db, 'users', { email: 'Cody.gmail.com' }, record => {
            return record.name.toLowerCase() == 'cody';
        } )).should.throw('Validation failed for column (email)');

    });
    it('Update records that have and "o" in the name', ()=>{
        const results2 = db.update( 'users', { name: '_oooo' }, record => {
            return record.name.includes('o');
        } );

        (results2).should.equal(5);
    });
    it('Delete Data', ()=>{
        const results = db.delete( 'users', record => {
            return record.name.toLowerCase() == 'philis';
        } );

        (results).should.equal(1);
    });
    it('Truncate non-existant table throws error', ()=>{
        (db.truncate.bind(db, 'products')).should.throw();
    });
    it('Commit should not throw error', async ()=>{
        (db.commit.bind(db)).should.not.throw();
    });
    it('db.file should now have a length of 7', async ()=>{
        const file = require(db.file);
        (file.users).should.have.a.lengthOf(7);
    });
    it('Truncate existant table does not throw error', ()=>{
        (db.truncate.bind(db, 'users')).should.not.throw();
    });
    it('Fetching table data should now return empty result set', ()=>{
        (db.fetch( 'users' )).should.have.lengthOf(0);
    });
    // it('Drop Table', ()=>{
    //     db.drop( 'users' ).should.be.true;
    // });
    // it('Fetching that same table should throw error', ()=>{
    //     (db.fetch.bind( db, 'users' )).should.throw();
    // });
} );