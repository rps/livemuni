module.exports = function(grunt) {

  require('matchdep').filterDev('grunt-*').forEach(grunt.loadNpmTasks);

  var changedFiles = Object.create(null);
  var onChange = grunt.util._.debounce(function() {
    grunt.config('jshint.files', Object.keys(changedFiles));
    changedFiles = Object.create(null);
  }, 200);

  grunt.event.on('watch', function(action, filepath) {
    changedFiles[filepath] = action;
    onChange();
  });  

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    concurrent: {
      dev: {
        options: {
          logConcurrentOutput: true
        },
        tasks: ['watch', 'nodemon', 'shell']
      }
    },
    nodemon: {
      dev: {
        options: {
          file: 'server/server.js',
          watchedFolders: ['server']
        }
      }
    },
    concat: {
      options: {
        separator: ';'
      },
      dist: {
        src: ['client/src/client.js', 'client/src/App.js', 'client/src/Map.js'],
        dest: 'client/dist/<%= pkg.name %>.js'
      }
    },
    uglify: {
      options: {
        banner: '/*! <%= pkg.name %> <%= grunt.template.today("dd-mm-yyyy") %> */\n',
        report: 'min'
      },
      dist: {
        files: {
          'client/dist/<%= pkg.name %>.min.js': ['<%= concat.dist.dest %>']
        }
      }
    },
    jshint: {
      files: ['client/src/*.js', 'server/**/*.js'],
      options: {
        '-W030': true,
        '-W083': true,
        '-W087': true,
        globals: {
          console: true,
          module: true,
          document: true
        }
      }
    },
    watch: {
      all: {
        files: ['<%= jshint.files %>'],
        tasks: ['newer:jshint'],
        options: {
          nospawn: true
        }
      },
      client: {
        files: ['client/src/*.js'],
        tasks: ['concat'],
      }, 
      css: {
        files: ['client/style.css'],
        options: {
          livereload: true
        }
      },           
      frontend: {
        files: ['client/dist/*.js', 'client/index.html'],
        options: {
          livereload: true
        }
      },
      pages: {
        files: ['client/*.{css,html}'],
        options: {
          livereload: true
        }
      }   
    },
    shell: {
      mongo: {
        command: '/usr/local/bin/mongodb/bin/mongod'
        // options: {
        //   async: true
        // }
      }
    }
  });

  grunt.registerTask('test', ['jshint']);
  grunt.registerTask('min', ['concat','uglify']);
  grunt.registerTask('default', ['jshint', 'concat', 'concurrent']);

};