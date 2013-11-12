module.exports = function(grunt) {

  require('matchdep').filterDev('grunt-*').forEach(grunt.loadNpmTasks);

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
      files: ['Gruntfile.js', 'client/src/*.js', 'server/**/*.js'],
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
        tasks: ['newer:jshint']
      },
      client: {
        files: ['client/src/*.js'],
        tasks: ['concat'],
      },      
      frontend: {
        files: ['client/dist/*.js', 'client/index.html', 'client/style.css'],
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
  grunt.registerTask('default', ['jshint', 'concat', 'uglify', 'concurrent']);

};