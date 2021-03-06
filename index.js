const fs = require( 'fs' );
const path = require( 'path' );
const Events = require( 'events' ).EventEmitter;

class Schema {
	/**
     * Creates an object that describes a table.
     * @param {string} name The name of the table
     */
	constructor( name ){
		this.columns = new Map();
		this.tableName = name;
		this.lastID = 0;
	}
	serialize(){
		return {
			lastID:  this.lastID,
			columns: Object.fromEntries( this.columns )
		};
	}
	/**
     * Add a column to this table.
     * @param {object} data 
     * @param {object} [data.type] This is the javascript type for the data that is expected in this column, Default: String
     * @param {boolean} [data.unique] Does this column expected to be unique for each record, default: false
     * @param {boolean} [data.required] Is this column required to have data? Default: false
     * @param {boolean} [data.autoIncrement] Is this an auto incrementing value? Default: false
     * @param {boolean} [data.nullable] Should the value of this column be allowed to be null, default: true
     * @param {any} [data.default] What should the value of this column be if no value is passed when inserting, default: null
     * @param {function} [data.validateFunc] All values passed to insert and update must return true from this function to be allowed to be entered into the record, default: false
     */
	addColumn( data ){
		if( this.columns.has( data?.name?.toLowerCase?.() ) ){
			throw new Error( `Column name must be unique. There is already a column named '${ data?.name }'.` );
		}
		this.columns.set( data.name, {
			type:          data.type ?? String,
			unique:        data.unique ?? false,
			required:      data.required ?? false,
			autoIncrement: data.autoIncrement ?? false,
			validateFunc:  data.validateFunc ?? false,
			default:       data.default ?? null,
			nullable:      data.nullable ?? true
		} );
	}
}

class Database extends Events {
	/**
     * @param {object} options 
     * @param {string} [options.file]
     * @param {string} [options.schemaFile]
     * @emits ready
     */
	constructor( options ){
		super();
		this.fileName = options.file ?? 'database';
		this.cacheTime = options.cacheTime ?? 1000 * 60 * 60;
		this._data = new Map();
		this._tables = new Map();
		this._fileLocked;
		this._schemaFile = options.schemaFile ?? path.resolve( __dirname, 'schema.json' );
		fs.stat( this.file, ( err, stats ) => {
			if( err ){
				fs.writeFile( this.file, JSON.stringify( {} ), async () => {  
					this.emit( 'ready' );
				} );
			} else if( !stats.isFile() ){ // File doesn't exist, create it.
				fs.writeFile( this.file, JSON.stringify( {} ), async () => {
					this.emit( 'ready' );
				} );
			} else {
				try {
					fs.readFile( this.file, async ( err, data ) => {
                        
						if( data.length == 0 ){
							this._data = new Map();    
						} else {
							this._data = this._convertToMap( JSON.parse( data ) );
						}
						//await this.loadSchemas();
						this.emit( 'ready' );
					} );
				} catch( e ){
					console.error( `Couldn't read database file ${ this.file }: ${ e.message }` );
				}
			}
		} );
		fs.watchFile( this.file ,( ) => {
			fs.readFile( this.file, () => {
				try{
					//this._data = this._convertToMap( JSON.parse( data ) );
				} catch( e ) {
					console.error( `Couldn't read database file ${ this.file }: ${ e.message }` );
				}
			} );
		} );
	}
	/**
     * Gets the full filename of the database file
     *
     * @readonly
     * @memberof Database
     */
	get file () {
		return path.resolve( __dirname, this.fileName + '.json' );
	}
	/**
     * Fetch data. 
     * @param {string} table The table to query
     * @param {function} [filter] - This needs to return true for any data that you want to match and get returned. If omitted, returns all records.
     * @returns {object}
     * @example database.fetch('users', record => { return record.name === 'Shelly' });
     */
	fetch( table, filter = () => {
		return true; 
	} ){
		if( this._data.has( table ) ){
			return this._data.get( table ).filter( filter );
		} else {
			throw new Error( `Table (${ table }) cannot be found.` );
		}
	}
	/**
     * Insert data into the table
     * @param {string} table 
     * @param {object} data
     * @returns {boolean} if it was successful 
     * @example database.insert('users', {
     *  name:  'Bob',
     *  email: 'bob@email.com'
     * });
     */
	insert( table, data ){
        
		const schema = this._tables.get( table );
		const d = this._validateData( data, schema );
		this._data.get( table ).push( d );
		schema.lastID = schema.lastID + 1;
		this._saveSchema();
		return d;
	}
	/**
     * Update records where the records pass the filter function with the data.
     * @param {string} table - the table name
     * @param {object} data - an object representing what you want to update
     * @param {function} [filter]
     * @returns {number} the number of affected records
     * @example database.update('users', { verified: true }, user => { return user.id == 5423 } );
     * database.update('users', { isChild: true }, user => { return user.age < 18 } );
     */
	update( table, data , filter = () => {
		return true; 
	} ){
		if ( this._data.has( table ) ){
			const schema = this._tables.get( table );
			//data = this._validateData(data, schema);
			var affected = 0;
			this._data.get( table ).forEach( ( record, index ) => {
				if( filter( record ) ){
					var t = Object.assign( {}, record );
					Object.keys( data ).forEach( key => {
						t[key] = data[ key ];
					} );
					try {
						this._validateData( t, schema );
						this._data.get( table )[index] = t;
						affected++;
					} catch( e ){
						throw new Error( e.message );
					}
				}
			} );
			return affected;
		} else {
			throw new Error( `Cannot find table (${ table }).` );
		}
	}
	/**
     * Delete record(s) that pass the filter
     * @param {string} table 
     * @param {function} [filter] Optional so this can be used in leu of database#truncate
     * @returns {number} the number of affected records
     * @example database.delete('inventory', item => { return item.expires < new Date(); })
     */
	delete( table, filter = () => {
		return true; 
	} ){
		if ( this._data.has( table ) ){
			const precount =  this._data.get( table ).length;
        
			this._data.set( table, 
				this._data.get( table ).filter( r =>{
					return !filter( r );
				} )
			);
			const postcount =  this._data.get( table ).length;
			return precount - postcount;
		} else {
			throw new Error( `Cannot find table (${ table }).` );
		}
	}
	/**
     * Clear all records from a table
     * @param {string} table 
     */
	truncate( table ){
		if ( this._data.has( table ) ){
			this._data.set( table, [] );
		} else {
			throw new Error( `Cannot find table (${ table }) to truncate it.` );
		}
	}
	/**
     * Drops (remove) table.
     * @param {string} table The table name
     * @returns {boolean} true/false it was successful
     */
	drop( table ) {
		if ( this._data.has( table ) ){
			this._tables.delete( table );
			this._saveSchema();
			return this._data.delete( table );
		} else {
			throw new Error( `Cannot find table (${ table }) to drop it.` );
		}
        
	}
	_convertToMap( d ){
		return new Map( Object.entries( d ) );
	}
	_convertFromMap( d ){
		return Object.fromEntries( d );
	}
	_validateData( data, schema ){
		if( schema !== undefined || schema !== 'undefined' ){
			var temp = {};
			const d = this._data.get?.( schema.tableName );
			schema.columns.forEach( ( options, column ) => {
				const isUndefined = ( typeof data[column] == 'undefined' || typeof data[column] == undefined );
				// Check autoIncrement
				if( options.autoIncrement ){
					if( !d.length ){
						temp[column] = 1;
					} else {
						var cols = d.map( u=>{
							return u[column];
						} );
						let max = Math.max( ...cols );
						temp[column] = max + 1;
					}
					return;
				}
				// Check Type
                
				if( ( typeof data?.[column] ).toLowerCase() == options.type.name.toLowerCase() ){
					temp[ column ] = data[ column ];
                    
					//Check if Unique
                    
					if( options.unique ){
						cols = d.filter( u=>{
							return u[column] == data['column'];
						} );
						if( cols.length ){
							throw new Error( `The value for column (${ column }) must be unique.` );
						}
					}
                
				} else {
					throw new TypeError( `Unexpected type (${ typeof data[column] }) for column ${ column }; Expecting a ${ options.type }` );
				}
				// Check if undefined and nullable
				if( isUndefined && options.required ){
					throw new Error( `Column (${ column }) is undefined and is a required field.` );
				} else if ( isUndefined && options.nullable ){
					temp[column] = null;
				} else if ( !isUndefined ) {
					if( ( options.validateFunc ? true : false ) ) {
						if ( options.validateFunc( data[column] ) ){
							temp[column] = data[column];
						} else {
							throw new Error( `Validation failed for column (${ column }) data (${ data[column] }).` ); 
						}
					} else {
						temp[column] = data[column];
					}
				} else {
					temp[column] = options.default;
				}
			} );

			//this._data.get( table ).push( temp );
			return temp;
		} else {
			throw new Error( `Attempt to insert data into table (${ schema.tableName }) failed. Table does not exist.` );
		}
	}
	/**
     * Create a table if it doesnt exist already. If it does, call database.drop('tableName'); first. 
     * 
     * @param {Schema} schema 
     */
	createTable( schema ) {
		if( !this._tables.has( schema.tableName ) ){
			this._saveSchema( schema );
		}
		if( !this._data.has( schema.tableName ) ){
			this._data.set( schema.tableName, [] );
		} else {
			throw new Error( `Table ( ${ schema.tableName } ) already exists.` );
		}
	}
	/**
     * Saves data to the file. 
     * @returns 
     */
	async commit(){
		if( this._fileLocked ){
			setTimeout( this.commit.bind( this ), 200 );
			return;
		}
		this._fileLocked = true;
		try {
			if( this._data.size==0 ){
				console.warn( 'Warning: Aborting; Writing an empty a array to the database' );
				this._fileLocked=false;
				return false;
			}
			fs.writeFile( this.file, JSON.stringify( this._convertFromMap( this._data ) ), 'utf8', err => {
				if( err ){
					throw new Error( err );
				}
				this._fileLocked=false;
				return true;
			} );
		} catch( e ){
			throw new Error( e.message );
		}
	}
	loadSchemas(){
		return new Promise( ( resolve, reject ) => {
			try {
				fs.readFile( this._schemaFile, ( err, data ) => {
                    
					if( data.length == 0 ){
						this._tables = new Map();    
					} else {
						const data = JSON.parse( data );
						this._tables.set( '', new Schema( {} ) );
					}
					resolve( this._tables );
				} );
			} catch( e ){
				reject( e );
				throw new Error( `Couldn't read schema file ${ this._schemaFile }: ${ e.message }` );
			}
		} );
	}
	_saveSchema( schema = null ){
		return new Promise( ( resolve ) => {
			// eslint-disable-next-line no-empty
			if ( schema == null ){
			} else if( !this._tables.has( schema.tableName ) ){
				this._tables.set( schema.tableName, schema );
			} else {
				throw new Error( `Schema for table (${ schema.tableName }) already exists. You may want to call drop(table) first.` );
			}
			fs.stat( this._schemaFile, ( err, stats ) => {
				if( err ){
					fs.writeFile( this._schemaFile,  this._formatSchemas(), () => {
						resolve();
					} );
				} else if( !stats.isFile() ){ // File doesn't exist, create it.
					fs.writeFile( this._schemaFile, JSON.stringify( this._convertFromMap( this._tables ), null, '\t' ), () => {
						resolve();
					} );
				} else {
					fs.writeFile( this._schemaFile, this._formatSchemas(), () => {
						resolve();
					} );
				}
			} );
		} );
	}
	_formatSchemas(){
		var hobbits = {};
		this._tables.forEach( ( value, key )=>{
			hobbits[key] = value.serialize();
		} );
		return JSON.stringify( hobbits, null, '\t' ); // ...to the shire.
	}
}
module.exports = { Database, Schema };