/*jshint node:true */

"use strict";

var colors = require('chalk');

function verifyTaskSets(gulp, taskSets, skipArrays) {
	if(taskSets.length === 0) {
		throw new Error('No tasks were provided to run-sequence');
	}
	var foundTasks = {};
	taskSets.forEach(function(t) {
    var taskType = typeof t;
		var isGulpTask = typeof t === "string",
      isFunction = typeof t === "function",
			isArray = !skipArrays && Array.isArray(t);
		if(!isGulpTask && !isArray) {
			throw new Error("Task "+t+" is not a valid task string.");
		}
		if(isGulpTask && !gulp.hasTask(t) && !isFunction) {
			throw new Error("Task "+t+" is not configured as a task on gulp.  If this is a submodule, you may need to use require('run-sequence').use(gulp).");
		}
		if(skipArrays && isGulpTask) {
			if(foundTasks[t]) {
				throw new Error("Task "+t+" is listed more than once. This is probably a typo.");
			}
			foundTasks[t] = true;
		}
		if(isArray) {
			if(t.length === 0) {
				throw new Error("An empty array was provided as a task set");
			}
			verifyTaskSets(gulp, t, true, foundTasks);
		}
	});
}

function runSequence(gulp) {
	// load gulp directly when no external was passed
	if(gulp === undefined) {
		gulp = require('gulp');
	}

	// Slice and dice the input to prevent modification of parallel arrays.
	var taskSets = Array.prototype.slice.call(arguments, 1).map(function(task) {
			return Array.isArray(task) ? task.slice() : task;
		}),
		callBack = typeof taskSets[taskSets.length-1] === 'function' ? taskSets.pop() : false,
		currentTaskSet,

		finish = function(err) {
			gulp.removeListener('task_stop', onTaskEnd);
			gulp.removeListener('task_err', onError);
			if(callBack) {
				callBack(err);
			} else if(err) {
				console.log(colors.red('Error running task sequence:'), err);
			}
		},
		onError = function(err) {
			finish(err);
		},
		onTaskEnd = function(event) {
      var task = typeof event === 'object' ? event.task : event,
        idx = idx = currentTaskSet.indexOf(event.task);

			if(idx > -1) {
				currentTaskSet.splice(idx,1);
			}
			if(currentTaskSet.length === 0) {
				runNextSet();
			}
		},

		runNextSet = function() {
			if(taskSets.length) {
				var command = taskSets.shift(),
          lastTaskType, count = -1;
				if(!Array.isArray(command)) {
					command = [command];
				}
        var reduced = command.reduce(function(list, task) {
          var taskType = typeof task;
          console.log('TYPE', taskType, lastTaskType);
          if(taskType !== lastTaskType) {
            count += 1;
            task = [task];
          }

          if(list[count]) {
            console.log('COUNT EXISTS', count, list[count]);
            list[count].push(task);
          } else {
            list.push(task);
          }
          list[count].type = taskType;
          lastTaskType = taskType;
          return list;
        }, []);
				currentTaskSet = command;
        gulp.start.apply(gulp, command);
			} else {
				finish();
			}
		};

	verifyTaskSets(gulp, taskSets);

	gulp.on('task_stop', onTaskEnd);
	gulp.on('task_err', onError);

	runNextSet();
}

module.exports = runSequence.bind(null, undefined);
module.exports.use = function(gulp) {
	return runSequence.bind(null, gulp);
};
