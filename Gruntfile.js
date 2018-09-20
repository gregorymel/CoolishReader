module.exports = function(grunt) {

	// Project configuration.
	grunt.initConfig({
		pkg: '<json:package.json>',
		meta: {
		banner: '/*! <%= pkg.name %> - v<%= pkg.version %> - ' +
			'<%= grunt.template.today("yyyy-mm-dd") %> */'
		},
		concat_sourcemap : {
			build: {
				options: {
					'sourceRoot': '../'
				},
      	files: {
					'reader/reader/js/reader.js': ['<banner>', 'node_modules/rsvp/dist/rsvp.js', 'node_modules/iota.lib.js/dist/iota-browser.js', 'node_modules/js-sha256/build/sha256.min.js', 'reader/src/core.js',  'reader/libs/iota/iota.js', 'reader/src/reader.js', 'reader/src/controllers/*.js'],
					'public/vendor/iota/iota.min.js': ['<banner>', 'node_modules/iota.lib.js/dist/iota-browser.js', 'node_modules/js-sha256/build/sha256.min.js', 'reader/libs/iota/iota.js']
				}
			}
		},
		uglify: {
			reader: {
				options: {
						preserveComments: 'some',
						sourceMap: false
				},
				files: {
					'reader/js/reader.min.js': ['<banner>', 'node_modules/rsvp/dist/rsvp.js', 'reader/src/core.js', 'reader/src/reader.js', 'reader/src/controllers/*.js']
				}
			}
		},
		copy: {
			main: {
				files: [
					{src: 'node_modules/localforage/dist/localforage.min.js', dest: 'reader/reader/js/libs/localforage.min.js'},
					{src: 'reader/libs/jszip/jszip.min.js', dest: 'reader/reader/js/libs/zip.min.js'},
					{src: 'node_modules/jquery/dist/jquery.min.js', dest:'reader/reader/js/libs/jquery.min.js'},
				  {src: 'node_modules/screenfull/dist/screenfull.js', dest: 'reader/reader/js/libs/screenfull.js'},
					{src: 'reader/src/plugins/search.js', dest: 'reader/reader/js/plugins/search.js'},
					{src: 'reader/src/plugins/hypothesis.js', dest: 'reader/reader/js/plugins/hypothesis.js'},
					{src: 'hooks/extensions/highlight.js', dest: 'reader/reader/js/hooks/extensions/highlight.js'},
					{src: 'node_modules/epubjs/dist/epub.min.js', dest: 'reader/reader/js/epub.min.js'},
					{src: 'node_modules/epubjs/dist/epub.js', dest: 'reader/reader/js/epub.js'},
					// {src: 'node_modules/epubjs/build/hooks.min.js', dest: 'reader/js/hooks.min.js'}
				]
			},
		},
		jshint: {
			all: ['src/**/*.js'],//, 'reader/**/*.js']
			options : {
				// Environments
				"browser": true,
				"devel": true,
				"worker": true,

				// Enforcing
				//"maxlen": 80,
				//"quotmark": "single",
				"trailing": true,
				"strict": false,

				// Relaxing
				"boss": true,
				"funcscope": true,
				"globalstrict": true,
				"loopfunc": true,
				"maxerr": 1000,
				"nonstandard": true,
				"sub": true,
				"validthis": true,

				"globals": {
					"_": false,
					"define" : false,
					"module" : false
				}
			}
		},
		watch: {
			scripts: {
				files: ['reader/src/**/*.js'],
				tasks: ['concat_sourcemap', 'uglify'],
				options: {
					interrupt: true,
				}
			},
		}
	});

	grunt.loadNpmTasks('grunt-contrib-concat');
	grunt.loadNpmTasks('grunt-contrib-uglify');
	grunt.loadNpmTasks('grunt-contrib-jshint');
	grunt.loadNpmTasks('grunt-concat-sourcemap');
	grunt.loadNpmTasks('grunt-contrib-copy');
	grunt.loadNpmTasks('grunt-contrib-watch');

	// Default task(s).
	grunt.registerTask('default', ['concat_sourcemap', 'uglify', 'copy']);
};
