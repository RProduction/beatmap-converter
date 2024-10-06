import Midifile from 'midifile';
import MIDIEvents from 'midievents';
import {readFile, writeFile} from 'fs/promises';
import Minimist from 'minimist';

const note_names = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];

function getNoteFromMidiNumber(midiNote){
  return note_names[midiNote % 12] + (Math.floor(midiNote / 12) - 1);
}

function CalculateStartTimeInS(delta, resolution) {
  return delta * resolution / (1000 * 1000);
}

async function Main() {
  // get argument -i midi file path -o output
  var argv = Minimist(process.argv.slice(2));
  console.log(argv);
  const buffer = await readFile(argv.i);
  //console.log(buffer);

  const midi = new Midifile(buffer, true);
  const track = midi.tracks[0].getTrackContent();
  const events = MIDIEvents.createParser(track, 0, true);

  const tickPerQuarter = midi.header.getTicksPerBeat();
  //console.log("Tick per beat: " + tickPerQuarter);

  let tickResolution = midi.header.getTickResolution();
  //console.log("Tick Resolution: " + tickResolution);
  
  let event;
  let totalDelta = 0;
  let i = 0;
  let tempo = 0;
  let res = {};
  /*let res = {
    note: [
      {
        delta: 0,
        duration: 0
      }
    ]
  };*/
  // loop over midi event and assign each note to object map
  // each note act as a key and its contain array
  // note on will set duration to -1
  // note off will be used to calculate duration between note on and note off
  // array of note will be sorted by delta time in second
  while(event = events.next()) {
    totalDelta += event.delta;
    
    if(event.type === MIDIEvents.EVENT_META) {
      if(event.subtype === MIDIEvents.EVENT_META_SET_TEMPO) {
        //console.log("set tempo");
        //console.log(event);
        tempo = event.tempo;
        tickResolution = midi.header.getTickResolution(tempo);
      }
    }

    if(event.type === MIDIEvents.EVENT_MIDI) {
      if(event.subtype === MIDIEvents.EVENT_MIDI_NOTE_ON) {
        //console.log("Note On");
        //console.log("Start Duration: " + totalDelta);

        const delta = CalculateStartTimeInS(totalDelta, tickResolution);
        //console.log("Start Duration in MS: " + delta);
        
        const note = getNoteFromMidiNumber(event.param1)
        //console.log("Note: " + getNoteFromMidiNumber(event.param1));
        //console.log(event);

        if (res[note] == undefined) {
          res[note] = []
        }

        res[note].push({
          delta,
          duration: -1
        });
        
      } else if(event.subtype === MIDIEvents.EVENT_MIDI_NOTE_OFF) {
        //console.log("Note Off");
        //console.log("Start Duration: " + totalDelta);
        
        const delta = CalculateStartTimeInS(totalDelta, tickResolution);
        //console.log("Start Duration in MS: " + delta);
        
        const note = getNoteFromMidiNumber(event.param1)
        //console.log("Note: " + getNoteFromMidiNumber(event.param1));
        //console.log(event);

        const cur = res[note][res[note].length - 1];
        if(cur.duration === -1) {
          res[note][res[note].length - 1] = {
            delta: cur.delta,
            duration: delta - cur.delta
          }
        }
      }
    }
  }

  console.log("result");
  console.log(res);

  // convert result into json object
  const jsonString = JSON.stringify(res, null, 2);
  await writeFile(`${argv.o}.json`, jsonString);
}

Main()