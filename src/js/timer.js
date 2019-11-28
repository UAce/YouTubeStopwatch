let bg = chrome.extension.getBackgroundPage(); // instance of background script

/*
 * VARIABLES
 */
var hours, minutes, seconds, remainingTime;
var exceededTime, exceededHours, exceededMinutes, exceededSeconds;
// console.log("Background remaining time", bg.remainingTime);
if (bg.remainingTime === 'undefined') {
  $('#displayedTime').html('Timer has not been set');
}
var preset_list;
var chart;
var listOfDates;
var listOfAllocatedTime;
var listOfTimeSpent;
var maxDate;
var minDate;
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
  if (remainingTime > 0) {
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
generateGraph();
// Show settings
$('#settings').click(function () {
  $('#popup-home').hide();
  $('#popup-settings').show('slide', { direction: 'left', easing: 'easeOutQuint' }, 200);
});

// Show last article
$('#showArticle').click(function () {
  chrome.runtime.sendMessage({ from: source.POPUP, event: event.SHOW_ARTICLE });
});


/*
 * SETTINGS
 */
function initSettings() {
  chrome.storage.sync.get({ 'soundOn': default_soundOn, 'presetTimes': jQuery.extend(true, {}, default_presets) }, function (data) {
    $("#soundOn").prop('checked', data.soundOn);
    preset_list = data.presetTimes;
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
  $('#displayedTime').removeClass('paused');
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
  } else if (event.shiftKey && (key === "A" || key === "KeyA" || key === 65)) {
    $('#showArticle').is(":hidden") ? $('#showArticle').show() : $('#showArticle').hide();
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
 * Graph
 */
function generateGraph() {
  chrome.storage.sync.get({ "sessions": [] }, function (data) {
    listOfDates = getListOfDates(data.sessions);
    listOfAllocatedTime = getListOfAllocatedTime(data.sessions);
    listOfTimeSpent = getListOfTimeSpent(data.sessions);
    maxDate = getMaxDate(listOfDates);
    minDate = getMinDate(listOfDates);
    config = {
      type: 'bar',
      data: {
        labels: listOfDates,
        datasets: [{
          label: "Time Spent on YouTube",
          data: listOfTimeSpent,
          backgroundColor: 'rgba(0, 153, 255, 1)',
          borderColor: 'rgba(0, 153, 255, 1)',
          order: 2,
          fill: false,
          borderWidth: 2,
          pointStyle: 'rect'
        },
        {
          label: "Allocated Time",
          type: 'bar',
          data: listOfAllocatedTime,
          backgroundColor: 'transparent',
          borderColor: 'rgba(204, 0, 0,1)',
          order: 1,
          fill: false,
          borderWidth: {
            top: 3,
            right: 0,
            bottom: 0,
            left: 0
          },
          pointStyle: 'line'
        }]
      },
      options: {
        responsive: true,
        tooltips: {
          mode: 'index',
          intersect: false,
          callbacks: {
            label: function (tooltipItem, data) {
              return data.datasets[tooltipItem.datasetIndex].label + ': ' + seconds_to_hh_mm_ss(tooltipItem.yLabel);
            }
          }
        },
        legend: {
          labels: {
            usePointStyle: true
          }
        },
        scales: {
          xAxes: [{
            type: 'time',
            stacked: true,
            time: {
              unit: 'day',
              tooltipFormat: 'll',
              unitStepSize: 1,
              displayFormats: {
                'day': 'MMM DD'
              }
            },
            data: {
              max: listOfDates[listOfDates.length - 1],
              min: listOfDates[0],
            },
            ticks: {
              max: maxDate,
              min: minDate,
            }
          }],
          yAxes: [{
            ticks: {
              userCallback: function (v) { return seconds_to_hh_mm_ss(v) },
              stepSize: 30 * 60,
              beginAtZero: true,
            },

          }]
        },
      }
    };
    var ctx = document.getElementById("myChart").getContext("2d");
    chart = new Chart(ctx, config);
  });
}

// Mutate timeSpent of last (current) session
function updateChartTimeSpent(time) {
  var data = chart.data.datasets[0].data;
  chart.data.datasets[0].data[data.length - 1] = time;
  chart.update();
}

function resetChart() {
  chart.data.datasets.forEach((dataset) => {
    dataset.data = [];
  });
  chart.options.scales.xAxes.ticks = {
    max: maxDate,
    min: minDate,
  };
  chart.update();
}

function seconds_to_hh_mm_ss(time) {
  var h = ~~((time / 3600));
  var min = ~~((time / 60) % 60);
  var sec = ~~(time % 60);
  return `${format_zero(h)}:${format_zero(min)}:${format_zero(sec)}`;
}

// Update Chart every 5s if there are active youtube pages and there is at least one active session
setInterval(function () {
  var sessions = bg.sessions;
  if (bg.active_youtube_tabs.length > 0 && sessions.length > 0 && chart) {
    updateChartTimeSpent(sessions[sessions.length - 1].timeSpent);
  }
}, 5000);


/*
 * HELPERS
 */
function format_undefined(num) {
  return num === 'undefined' ? '--' : num;
}

function format_zero(num) {
  return num < 10 ? "0" + num : num;
}

function getListOfAllocatedTime(data) {
  var listOfAllocatedTime = [];
  for (var i = 0; i < data.length; i++) {
    listOfAllocatedTime.push(data[i].allocatedTime);
  }
  return listOfAllocatedTime;
}

function getListOfTimeSpent(data) {
  var listOfTimeSpent = [];
  for (var i = 0; i < data.length; i++) {
    listOfTimeSpent.push(data[i].timeSpent);
  }
  return listOfTimeSpent;
}

function getListOfDates(data) {
  var listOfDates = [];
  for (var i = 0; i < data.length; i++) {
    var date = data[i].date;
    listOfDates.push(moment(date));
  }
  return listOfDates;
}

function newDate2(days) {
  var d = moment().add(days, 'd').startOf('day');
  return d;
}

function newDate(date, days) {
  // console.log("new date:", date);
  var d = moment(date).add(days, 'd').startOf('day');
  return d;
}

function getMaxDate(dates) {
  var n = dates.length;
  var date = moment()._d.getTime();
  // console.log(date);
  if (n > 0) {
    date = dates[n - 1];
  }
  return newDate(date, 1);
}

function getMinDate(dates) {
  var n = dates.length;
  var date = moment()._d.getTime();
  // console.log(date);
  if (n > 0) {
    date = dates[0];
  }
  return newDate(date, -1);
}