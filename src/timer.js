   // countdown for 1 minute
   countdown(60);

   function countdown(seconds) {
     // TODO: 
     // Timer resets each time chrome extension window is open because of the new Date().getTime() call
     // the now variable should be instantiated the moment Youtube countdown value has been inputed, 
     // than passed into the function countdown(seconds, now) as an argument in order to fix this incorrect implementation
     var now = new Date().getTime();
     var target = new Date(now + seconds * 1000);
     var update = 500;
     
     var int = setInterval(function () {
       var now = new Date();
       var remaining = (target - now) / 1000;
       if (remaining < 0) {
         clearInterval(int);
         return;
       }
       var minutes = ~~(remaining / 60);
       var seconds = ~~(remaining % 60);
       document.getElementById("countdown").innerHTML
         = format(minutes) + ":" + format(seconds);
     }, update);
   }
   
   function format(num) {
     return num < 10 ? "0" + num : num;
   }
   