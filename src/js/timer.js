/*
 * CONSTANTS
 */
const status = {
  STARTED: 'started',
  STOPPED: 'stopped',
  OVER: 'over'
};
const source = {
  BACKGROUND: 'background',
  PAGE: 'youtube',
  POPUP: 'popup'
};
const event = {
  INIT: 'init',
  RESET: 'reset',
  SNACKBAR: 'showSnackbar',
  CLOSE_TAB: 'closeTab',
  START_COUNTDOWN: 'startCountdown',
  SHOW_ARTICLE: 'showArticle',
  START_OVERTIME: 'startOvertime'
};
const default_presets = { "30min": 30, "1h": 60, "2h": 120, "12h": 720 };
const default_soundOn = true;
let background = chrome.extension.getBackgroundPage(); // instance of background script


/*
 * VARIABLES
 */
var hours, minutes, seconds, remainingTime;
var timeOver, hoursOver, minutesOver, secondsOver;
if (typeof (background.remainingHours) === 'undefined' || typeof (background.remainingMinutes) === 'undefined' || typeof (background.remainingSeconds) === 'undefined') {
  $('#displayedTime').html('Timer has not been set');
}
var preset_list;


/*
 * COUNTDOWN/OVERTIME
 */
var intervalId = setInterval(function () {
  background = chrome.extension.getBackgroundPage(); // instance of background script
  var countdown_status = background.countdown_status;

  if (countdown_status === status.STARTED) {
    // Countdown
    hours = background.remainingHours;
    minutes = background.remainingMinutes;
    seconds = background.remainingSeconds;
    remainingTime = Math.floor(background.remainingTime);

    if (remainingTime <= 0 && $('#displayedTime').html() !== "Time's up!!") {
      $('#displayedTime').html("Time's up!!");
    } else if (remainingTime > 0) {
      $('#displayedTime').html('Time remaining: ' + format(hours) + ":" + format(minutes) + ":" + format(seconds));
    }
  } else if (countdown_status === status.OVER) {
    // Overtime
    hoursOver = background.hoursOver;
    minutesOver = background.minutesOver;
    secondsOver = background.secondsOver;
    $('#displayedTime').html("Overtime");
    if (typeof (hoursOver) !== 'undefined' && typeof (minutesOver) !== 'undefined' && typeof (secondsOver) !== 'undefined') {
      $('#displayedTime').append(': ' + format(hoursOver) + ":" + format(minutesOver) + ":" + format(secondsOver));
    }
  }
}, 500);


/*
 * POPUP HOME
 */
// Show settings
$('#settings').click(function () {
  $('#popup-home').hide();
  $('#popup-settings').show('slide', { direction: 'left', easing: 'easeOutQuint' }, 200);
});

// Show last article
$('#showLastArticle').click(function () {
  chrome.runtime.sendMessage({ from: source.POPUP, event: event.SHOW_ARTICLE });
});


/*
 * SETTINGS
 */
function initSettings() {
  chrome.storage.sync.get(['soundOn', 'presetTimes'], function (data) {
    $("#soundOn").prop('checked', data.soundOn || default_soundOn);
    preset_list = data.presetTimes || jQuery.extend(true, {}, default_presets);
    populatePresets();
    showPresets();
  });

  // Show message if empty preset list
  $('#preset_list').on("DOMSubtreeModified", function () {
    showPresets();
  });
}
initSettings();

function showPresets() {
  if (Object.keys(preset_list).length <= 0) {
    $('#empty_list').show();
    $('#preset_list').hide();
  } else {
    $('#empty_list').hide();
    $('#preset_list').show();
  }
}
// Return to home
$('#back').click(function () {
  $('#popup-home').show('slide', { direction: 'right', easing: 'easeOutQuint' }, 200);
  $('#popup-settings').hide();
});

// Reset
$('#reset').click(function () {
  chrome.storage.sync.clear(function () {
    chrome.runtime.sendMessage({ from: source.POPUP, event: event.RESET });
    $('#displayedTime').html('Timer has not been set');
  });
  $('#preset_list').html('');
  initSettings();
});

// Show/Hide reset button on 'Shift + R'
document.addEventListener('keydown', function (event) {
  if (event.defaultPrevented || $('#popup-settings').is(":hidden")) {
    return;
  }
  var key = event.key || event.keyCode;
  if (event.shiftKey && (key === "R" || key === "KeyR" || key === 82)) {
    $('#reset').is(":hidden") ? $('#reset').show() : $('#reset').hide();
  }
});

// Save setting changes
$('#save_changes').click(function () {
  chrome.storage.sync.set({
    'soundOn': $('#soundOn').prop('checked'),
    'presetTimes': preset_list
  }, function () {
    var snackbar = document.getElementById("saved_snackbar");
    snackbar.className = "show";
    $('#save_changes').attr("disabled", true);

    setTimeout(function () {
      snackbar.className = snackbar.className.replace("show", "");
      $('#save_changes').removeAttr("disabled");
    }, 2000);
  });
});

// Restore default settings
$('#restore_default').click(function () {
  // Default values: soundOn = true
  $("#soundOn").prop('checked', true);
  preset_list = jQuery.extend(true, {}, default_presets);
  $('#preset_list').html('');
  populatePresets();
});


/*
 * PRESETS
 */
function populatePresets() {
  for (var preset in preset_list) {
    addOption(preset, preset_list[preset]);
  }
}

function addOption(stringVal, intVal) {
  // Append input number + h or min, e.g. 1 + h -> "1h"
  preset_list[stringVal] = Number(intVal);
  var delete_button = document.createElement('button');
  delete_button.className = 'delete-times-circle';
  delete_button.innerHTML = '<i class="fa fa-times-circle"></i>';
  var new_preset = document.createElement('li');
  new_preset.innerHTML = stringVal;
  new_preset.id = stringVal;
  new_preset.appendChild(delete_button);
  $('#preset_list').append(new_preset);
  $(`#${stringVal}`).find('button').click(function () {
    delete preset_list[stringVal];
    $(`#${stringVal}`).remove();
  });

  setTimeout(function () {
    new_preset.className = new_preset.className + " show";
  }, 10);
}

// Validate preset options
function validatePresets() {
  var h = $('#preset_hours_input').val();
  var min = $('#preset_minutes_input').val();
  if (min > 59 || min < 0 || h > 23 || h < 0 || (h == 0 && min == 0)) {
    $('#add_preset').attr("disabled", true);
  } else {
    $('#add_preset').removeAttr("disabled");
  }
}
$('#preset_hours_input').on('input', validatePresets);
$('#preset_minutes_input').on('input', validatePresets);

$('#add_preset').click(function () {
  var preset_string = "";
  var preset_val = 0;
  var h = $('#preset_hours_input').val() || 0;
  var min = $('#preset_minutes_input').val() || 0;
  if (h !== 0) {
    preset_string += (h + "h");
    preset_val += (h * 60);
  }
  if (min !== 0) {
    preset_string += (min + "min");
    preset_val += (min);
  }
  if (preset_list.hasOwnProperty(preset_string)) {
    clear_inputs();
    return;
  }
  addOption(preset_string, preset_val);
  clear_inputs();
});

function clear_inputs() {
  $('#preset_hours_input').val('');
  $('#preset_minutes_input').val('');
}

/*
 * HELPERS
 */
function format(num) {
  return num < 10 ? "0" + num : num;
}