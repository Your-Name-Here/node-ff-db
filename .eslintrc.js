module.exports = {
	env: {
		es6:  true,
		node: true
	},
	extends: 'eslint:recommended',
	globals: {
		Atomics:           'readonly',
		SharedArrayBuffer: 'readonly'
	},
	parserOptions: {
		ecmaVersion: 2020,
		sourceType:  'module'
	},
	rules: {
		//'vars-on-top':            'error',
		'camelcase':              'error',
		'key-spacing':            ['error', { 'align': 'value' }],
		'brace-style':            ['error', '1tbs', { 'allowSingleLine': false }],
		'block-spacing':          'error',
		'no-unused-vars':         'warn',
		'semi':                   ['warn', 'always'],
		'comma-style':            ['error', 'last'],
		'indent':                 ['error', 'tab'],
		'quotes':                 ['error', 'single'],
		'space-in-parens':        ['error', 'always'],
		'template-curly-spacing': ['error', 'always'],
	}
};
