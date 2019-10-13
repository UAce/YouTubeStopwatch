// Global var
var background = chrome.extension.getBackgroundPage(); // instance of background script
console.log("background:", background);
var minutes, seconds;
var countdown = document.getElementById("countdown");

var intervalId = setInterval(function () {
  background = chrome.extension.getBackgroundPage(); // instance of background script
  minutes = background.remainingMinutes;
  seconds = background.remainingSeconds;
  console.log(format(minutes) + ":" + format(seconds));
  if (typeof (minutes) === 'undefined' || typeof (seconds) === 'undefined') {
    countdown.innerHTML = 'Countdown not started yet';
  } else if (minutes + seconds === 0) {
    countdown.innerHTML = "Time's up!!!";
    clearInterval(intervalId);
    alert("Time's Up!!");
  } else {
    countdown.innerHTML = 'Time remaining: ' + format(minutes) + ":" + format(seconds);
  }
}, 500);

function format(num) {
  return num < 10 ? "0" + num : num;
}