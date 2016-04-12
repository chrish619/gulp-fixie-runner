"use strict";

var path = require("path");
var through = require('through2');
var gutil = require('gulp-util');
var child_process = require('child_process');

var FIXIE_CONSOLE = 'Fixie.Console.exe',
    FIXIE_X86_CONSOLE = 'Fixie.Console.x86.exe',
    PLUGIN_NAME = 'gulp-fixie-runner';

module.exports = function(options) {
    var _files = [],
        _args = [],
        _options = options || {},
        _stream;

    _stream = through.obj(function addFileFromStream(file, enc, cb) {
        _files.push(file);

        if (options.debug) {
            gutil.log('[' + gutil.colors.green('Fixie') + ']', 'Adding test file', gutil.colors.yellow(file.path));
        }

        this.emit('data', file);

        if (cb) { cb(); }

    }, function flushStream(cb) {
        run(this, _files, _options);
    });

    return _stream;

    function run(stream, files, options) {
        var assemblyPaths,
            spawnOpts,
            child,
            binaryPath,
            args;

        files = files || [];
        options = options || {};

        if (options.debug) {
            gutil.log('[' + gutil.colors.green('Fixie') + ']', 'Should run all tests now');
        }

        assemblyPaths = files.map(function(file) { return file.path; });

        binaryPath = getBinaryPath(options);
        if (options.debug) {
            gutil.log('[' + gutil.colors.green('Fixie') + ']', 'Running Fixie console at', binaryPath);
        }

        args = getArgs(options, assemblyPaths);

        if (options.debug) {
            gutil.log('[' + gutil.colors.green('Fixie') + ']', 'Running Fixie console with args', args);
        }

        gutil.log('[' + gutil.colors.green('Fixie') + ']', gutil.colors.cyan('Starting test cycle'));
        spawnOpts = {
            stdio: [null, process.stdout, process.stderr, 'pipe']
        };
        child = child_process.spawn(binaryPath, args, spawnOpts);

        child.on('error', function(e) {
            error(stream, e.code === 'ENOENT' ? 'Unable to find \'' + binaryPath + '\'.' : e.message);
        });

        child.on('close', function(code) {

            if (code !== 0) {
                gutil.log('[' + gutil.colors.green('Fixie') + ']', gutil.colors.red('Tests Failed'));
                error(stream, 'Fixie tests failed.');
                
            } else {
                gutil.log('[' + gutil.colors.green('Fixie') + ']', gutil.colors.cyan('Tests passed'));
            }
            return end(stream);
        });
    }

    function getBinaryPath(options) {
        var binaryPath,
            defaultRunner;
        defaultRunner = options.platform === 'x86' ? FIXIE_X86_CONSOLE : FIXIE_CONSOLE;

        /* for runners in %PATH% */
        if (!options.executable) { return defaultRunner; }

        binaryPath = options.executable.replace(/^[\s\"\']+|[\s\"\']+$/gi, '');

        if (path.extname(binaryPath)) {
            /* Full path specified, don't correct console runner */
            return binaryPath;
        }
        return path.join(binaryPath, defaultRunner);
    }

    function getArgs(options, assemblyPaths) {
        var args = [], i = 0;

        if (options.format === 'nunit' || !options.format) { args.push('--NUnitXml'); }
        if (options.format === 'xunit') { args.push('--xUnitXml'); }


        args.push(options.result || 'TestResult.xml');

        if (typeof options.teamcity !== 'undefined') {
            args.push('--TeamCity');
            args.push(options.teamcity === true || options.teamcity === 'on' ? 'on' : 'off');
        }

        if (options.args) {
            for (var k in options.args) {
                args.push('--' + k);
                args.push(options.args[k]);
            }
        }

        for (i = 0; i < assemblyPaths.length; i++) {
            args.push(assemblyPaths[i]);
        }

        return args;
    }

    function error(stream, msg) {
        stream.emit('error', new gutil.PluginError(PLUGIN_NAME, msg));
    }

    function end(stream) {
        stream.emit('end');
    }
};