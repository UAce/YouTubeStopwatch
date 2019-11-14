let bg = chrome.extension.getBackgroundPage(); // instance of background script

/*
 * VARIABLES
 */
var hours, minutes, seconds, remainingTime;
var exceededTime, exceededHours, exceededMinutes, exceededSeconds;
if (bg.remainingTime === 'undefined') {
  $('#displayedTime').html('Timer has not been set');
}
var preset_list;


/*
 * COUNTDOWN/OVERTIME
 */
var intervalId = setInterval(function () {
  bg = chrome.extension.getBackgroundPage(); // instance of bg script
  // console.log(bg.remainingTime);
  if (bg.remainingTime === 'undefined') {
    return;
  }
  if (bg.active_youtube_tabs.length > 0) {
    $('#displayedTime').removeClass('paused');
  } else {
    $('#displayedTime').addClass('paused');
  }
  remainingTime = Math.floor(bg.remainingTime);
  if (remainingTime === 0 && $('#displayedTime').html() !== "Time's up!!") {
    $('#displayedTime').html("Time's up!!");
  } else if (remainingTime > 0) {
    // Countdown
    hours = format_undefined(bg.remainingHours);
    minutes = format_undefined(bg.remainingMinutes);
    seconds = format_undefined(bg.remainingSeconds);
    $('#displayedTime').html('Time remaining: ' + format_zero(hours) + ":" + format_zero(minutes) + ":" + format_zero(seconds));
  } else {
    // Overtime
    exceededTime = bg.exceededTime;
    exceededHours = format_undefined(bg.exceededHours);
    exceededMinutes = format_undefined(bg.exceededMinutes);
    exceededSeconds = format_undefined(bg.exceededSeconds);
    $('#displayedTime').html("Overtime");
    if (exceededTime > 0) {
      $('#displayedTime').append(': ' + format_zero(exceededHours) + ":" + format_zero(exceededMinutes) + ":" + format_zero(exceededSeconds));
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
    var soundOn = typeof (data.soundOn) === 'undefined' ? default_soundOn : data.soundOn;
    $("#soundOn").prop('checked', soundOn);
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
  chrome.runtime.sendMessage({ from: source.POPUP, event: event.RESET });
  chrome.storage.sync.set({
    'remainingTime': 'undefined',
    'exceededTime': 'undefined',
    'blur_value': default_blurValue
  });
  $('#displayedTime').html('Timer has not been set');
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
    'soundOn': $('#soundOn').prop('checked'), 'presetTimes': preset_list
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
  $("#soundOn").prop('checked', default_soundOn);
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
function format_undefined(num) {
  return num === 'undefined' ? '--' : num;
}
function format_zero(num) {
  return num < 10 ? "0" + num : num;
}