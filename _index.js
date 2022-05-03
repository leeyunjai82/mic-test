// setup util 20201207
console.log('[MIC TEST] version', 20220425);

const fs = require('fs');
const { execSync, spawn } = require('child_process');
const threshold = 76;
const margin = 1;
let errcnt = 0;
let volume = 200;
let before = 0

//console.log('[MIC TEST] TIME SETTING:', execSync('ntpdate kr.pool.ntp.org').toString());
execSync('gpio mode 7 out;gpio write 7 1;amixer -c Headphones sset Headphone 90%;amixer -c sndrpii2scard sset Boost 196');
execSync('play /media/usb/start.mp3');
setTimeout(function(){
  start();
}, 5000);

function median(numbers) {
  const sorted = numbers.slice().sort();
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }
  return sorted[middle];
}

function start(){
  console.log('[MIC TEST] Volume:',volume);

  let buffer = [];
  let startTime = Date.now();
  let ps = spawn('arecord',['-D','dmic_sv','-c2','-r','44100','-f','S32_LE','-t','wav','-vv','-V','stereo','/home/pi/record_src.wav']);

  ps.stdout.on('data',function(data){
  });

  ps.stderr.on('data', function(data){
    let progress = data.toString('utf8');

    if( progress.indexOf('%') > 0 || progress.indexOf('MAX') > 0 ){
      isMax = false;

      if(progress.indexOf('MAX') > 0){
        isMax = true;
        return;
      } 

      if(Date.now() - startTime > 7500){
        console.log('[MIC TEST] continue...');
        ps.kill();
      }

      let num = parseInt(progress.split('%|')[0].split('# ')[1]);
      if(before !== num){
        before = num
        console.log('level',num + '%');
      }

      if(isNaN(num)){
        errcnt++;
      } else {
        buffer.push(num);
      }
    }
  });

  ps.on('error',function(err){
    console.log('[MIC TEST] ps.on(error)', err);
  });

  ps.on('close', function(code){
    let md = median(buffer);
    console.log('[MIC TEST] median(level)', md);
    
    if(isNaN(md)){
      execSync('play /media/usb/fail_mic.mp3')
      console.log('[MIC TEST] Fail');
      execSync('amixer -c Headphones sset Headphone 80%');
      return;
    }

    if(md == threshold){
      console.log('[MIC TEST] Finish -', volume);
      if(volume <= 210 && volume >= 190){
        execSync('alsactl store;play /media/usb/ok.mp3')
        console.log('[MIC TEST] OK');
      }
      else if(errcnt > 0){
        execSync('play /media/usb/fail_mic.mp3')
        console.log('[MIC TEST] Fail');
      }
      else {
        execSync('play /media/usb/fail_level.mp3')
        console.log('[MIC TEST] Fail');
      }
      execSync('amixer -c Headphones sset Headphone 80%');
      return;
    } 

    // FAST
    if(Math.abs(md - threshold) > 10){
      volume = md < threshold? volume+10 : volume-10;
    }
    else if(Math.abs(md - threshold) > 5){
      volume = md < threshold? volume+5 : volume-5;
    }
    else if(Math.abs(md - threshold) > 2){
      volume = md < threshold? volume+2 : volume-2;
    }
    else { //step slow exactly
      volume = md < threshold? volume+1 : volume-1;
    }
    execSync('amixer -c sndrpii2scard sset Boost ' + volume);
    start();
  });
}
