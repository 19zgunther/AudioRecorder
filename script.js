
class Point
{
    constructor(x,y)
    {
        this.x = x;
        this.y = y;
    }
    sub(other)
    {
        return new Point(this.x - other.x, this.y - other.y);
    }
}

const trackTemplate = `
    <div class="trackParent" id="trackParent_#">
        <div class="trackHeader">
            <div class="trackHeaderName" id="trackName_#">
                Track Name
            </div>
            <div class="trackButtonParent">
                <div class="trackButton" id="trackMuteButton_#">
                    Mute
                </div>
                <div class="trackButton" id="trackSoloButton_#">
                    Solo
                </div>
            </div>
            <input type="range" min="0" max="100"class="trackHeaderVolume" id="trackVolume_#"/>
        </div>
        <div class="trackBody">
            <canvas class="trackCanvas" id="trackCanvas_#">
            </canvas>
        </div>
        
    </div>
`;


class Clip
{
    constructor(blob, arrayBuffer, audioBuffer, data, avgData, startTime)
    {
        this.blob = blob;
        this.arrayBuffer = arrayBuffer;
        this.audioBuffer = audioBuffer;
        this.data = data;
        this.averageData = avgData;
        this.startTime = startTime;
    }
}

class Track
{
    constructor(parentElement)
    {
        if (parentElement == null) { throw "Track(): parentElement cannot be null."; }

        //create and name track elements
        parentElement.innerHTML += trackTemplate;
        this._initHTMLElements(this);

        this.id = Math.round(Math.random() * 1000000);
        this.mute = false;
        this.solo = false;

        this.audioClips = [];


        //Various useful components - set in this.render()
        this.timeToPixelMultiplier = 100;
        this.bpm = 100;
        this.sampleRate = 48000;

        //for controling...
        this.state = "idle";      // user state used for statemachine
        this.mouseIsDown = false;
        this.mousePos = new Point();
        this.deltaMousePos;
        this.selectedClip = null;
    }
    _initHTMLElements(selfObject) {
        let elementIDs =["trackName_", "trackMuteButton_", "trackSoloButton_", "trackVolume_", "trackCanvas_", "trackParent_"];
        for (let i in elementIDs)
        {
            let element = document.getElementById(elementIDs[i] + "#");
            if (element != null)
            {
                element.setAttribute("id",  elementIDs[i] + this.id );
            } else {
                console.error("Could not find element with id: " + elementIDs[i] + "#");
            }
        }

        this.muteButtonElement = document.getElementById("trackMuteButton_" + this.id);
        this.muteButtonElement.addEventListener("click", function(e) {
            selfObject._muteButtonHandler();
        });

        this.soloButtonElement = document.getElementById("trackSoloButton_" + this.id);
        this.soloButtonElement.addEventListener("click", function(e) {
            selfObject._soloButtonHandler();
        });


        this.canvasElement = document.getElementById("trackCanvas_" + this.id);
        ["keypressed", "keyreleased","click", "drag","mousedown", "mousemove", "mouseup", "mousedrag"].forEach(function(event)
        {
            selfObject.canvasElement.addEventListener(event, function(e) {
                selfObject._canvasMouseHandler(e);
            });
        });




        this.canvasElement = document.getElementById("trackCanvas_"+this.id);
    }

    /** @param {boolean} val */
    set mute(val) {
        console.log(this.muteButtonElement.className + " val:" + val);

        let s = this.muteButtonElement.className;
        this.muteButtonElement.className = s.replace(" selected", "");

        if (val == true)
        {
            this.muteButtonElement.className += " selected";
            this._mute = true;
        } else {
            this._mute = false;
        }
    }
    get mute() {
        return this._mute;
    }
    _muteButtonHandler() {
        if (this.mute == true) {
            this.mute = false;
        } else {
            this.mute = true;
        }
    }

    /** @param {boolean} val */
    set solo(val) {
        console.log(this.soloButtonElement.className + " val:" + val);

        let s = this.soloButtonElement.className;
        this.soloButtonElement.className = s.replace(" selected", "");

        if (val == true)
        {
            this.soloButtonElement.className += " selected";
            this._solo = true;
        } else {
            this._solo = false;
        }
    }
    get solo() {
        return this._solo;
    }


    _soloButtonHandler() {
        if (this.solo == true) {
            this.solo = false;
        } else {
            this.solo = true;
        }
    }

    __getClipAtPos(pos)
    {
        //pos must be instance of Point, or have attribute .x
        //pos is the pixel pos relative to the upper lefthand of canvas

        if (pos.y < 0 || pos.y > this.canvasElement.height)
        {
            return;
        }
        for (let i=0; i<this.audioClips.length; i++)
        {
            const c = this.audioClips[i];
            const startX = c.startTime * this.timeToPixelMultiplier;
            const endX = startX + c.audioBuffer.duration * this.timeToPixelMultiplier;
            if (startX <= pos.x && endX >= pos.x)
            {
                return c;
            }
        }   
    }
    _canvasMouseHandler(event) {
        //console.log(event);
        let mp; //mousePosition
        let clipOver;
        let keyPressed;
        let keyPressedRaw;

        const ev = event.type; //we'll be writing this a lot...
        switch(ev)
        {
            case "mousedown":
                mp = new Point(event.offsetX, event.offsetY);
                clipOver = this.__getClipAtPos(mp);
                break;
            case "mousemove":
                mp = new Point(event.offsetX, event.offsetY);
                clipOver = this.__getClipAtPos(mp);
                break;
            case "mouseup":
                mp = new Point(event.offsetX, event.offsetY);
                clipOver = this.__getClipAtPos(mp);
                break;
            case "mousedrag":
                mp = new Point(event.offsetX, event.offsetY);
                clipOver = this.__getClipAtPos(mp);
                break;
            case "drag":
                mp = new Point(event.offsetX, event.offsetY);
                clipOver = this.__getClipAtPos(mp);
                break;
            case "click":
                mp = new Point(event.offsetX, event.offsetY);
                clipOver = this.__getClipAtPos(mp);
                break;
            case "mouseenter":
                mp = new Point(event.offsetX, event.offsetY);
                clipOver = this.__getClipAtPos(mp);
                this.state = "idle";
                this.selectedClip = null;
                break;
            case "mouseleave":
                this.state = "idle";
                this.selectedClip = null;
                break;
            case "keypressed":
                console.log(event);
                break;
            default:
                console.log(event);
                break;

        }
        //set mousePos and deltaMousePos
        if (mp != null)
        {
            this.deltaMousePos = mp.sub(this.mousePos);
            this.mousePos = mp;
        }

        if (this.state == "idle")
        {
            if (ev == "mousedown" && clipOver != null)
            {
                this.mouseIsDown = true;
                this.state = "moving";
                this.selectedClip = clipOver;
                return;
            }
        }

        if (this.state == "moving")
        {
            if (ev == "click" || ev == "mouseup")
            {
                this.state = "idle";
                return;
            }

            if (ev == "mousemove" || ev == "drag" || ev == "mousedrag")
            {
                //find the closest beat.
                //we have... this.bpm, this.timeToPixelMultiplier == pixelsPerSecond
                console.log("Moving clip...");
                const bps = this.bpm/60; //beats per second
                const timeAtMouse = this.mousePos.x / this.timeToPixelMultiplier; // convert mouse pixel into time
                const beatAtMouse = Math.round(timeAtMouse * bps); //conver mouse time into beat
                
                this.selectedClip.startTime = beatAtMouse / bps;
            }
        }



    }

    addAudioClip(blob, startTime)
    {
        //take blob --> arrayBuffer --> AudioBuffer --> array
        const selfObject = this;
        blob.arrayBuffer().then(function (buffer) {
            audioCtx.decodeAudioData(buffer).then(function (audioBuffer) {

                let data = audioBuffer.getChannelData(0);

                let averageData = [];
                let avg = 0;
                for (let i=0; i<data.length; i++)
                {
                    avg = avg*0.99 + Math.abs(data[i])*0.01;
                    averageData.push(avg);
                }

                selfObject.audioClips.push(new Clip(blob, buffer, audioBuffer, data, averageData, startTime));

                /*obj.audioClips.push({
                    blob: blob,
                    arrayBuffer: buffer,
                    audioBuffer: audioBuffer,
                    data: arr,
                    averageData: averageData,
                    startTime: startTime,
                });*/
            });
        });
    }
    addAudioClipObj(clip)
    {
        if ( !(clip instanceof Clip ) )
        {
            console.error("Track.addAudioClipObj(): Audio clip must be of type Clip");
            return;
        }
        this.audioClips.push(clip);
    }

    render(numPixelsPerSecond = 20, bpm = 100) {

        const bb = this.canvasElement.getBoundingClientRect();
        this.canvasElement.width = bb.width;
        this.canvasElement.height = bb.height;
        //const w = this.canvasElement.width;
        //const h = this.canvasElement.height;
        const w = bb.width;
        const h = bb.height;
        const ctx = this.canvasElement.getContext("2d");
        ctx.clearRect(0, 0, w, h);

        const timeToPixelMultiplier = numPixelsPerSecond;
        const sampleRate = 48000; //TODO - get this from... somewhere..?
        const sampleToPixelMultiplier = 1/sampleRate * timeToPixelMultiplier;

        const pixelToSampleMultiplier = 1/sampleToPixelMultiplier;


        this.timeToPixelMultiplier = timeToPixelMultiplier;
        this.bpm = bpm;
        this.sampleRate = sampleRate;


        //draw each audio clip
        for(let i=0; i<this.audioClips.length; i++)
        {
            const c = this.audioClips[i];
            const arr = c.averageData;
            const clipLengthSeconds = c.audioBuffer.duration;

            const startX = Math.round(c.startTime * timeToPixelMultiplier);
            //console.log("i: " + i + "  startX: " + startX + "  lengthSec: " + clipLengthSeconds);
            const startY = Math.round(h/2);
            const yMultiplier = h/2;

            
            ctx.fillStyle = "#6666FF66";
            ctx.strokeStyle = "#FF6666";

            if (c == this.selectedClip)
            {
                ctx.fillStyle = "#7777FF55";
            }

            ctx.fillRect(startX, 0, clipLengthSeconds*timeToPixelMultiplier, h);
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            let yVal;
            for (let j=0; j<clipLengthSeconds*timeToPixelMultiplier; j++)
            {
                if (startX + j > w)
                {
                    break;
                }
                yVal = Math.round(arr[j*pixelToSampleMultiplier] * yMultiplier) + 1;
                ctx.moveTo(startX + j, startY + yVal )
                ctx.lineTo(startX + j, startY - yVal );
            }
            ctx.stroke();
            ctx.closePath();
        }

        //draw beat lines
        let incrementor = 1/(bpm/60) * timeToPixelMultiplier;

        // beats/second * pixel/second
        ctx.beginPath();
        ctx.strokeStyle="#FFFFFF44";
        for(let i=0; i<w; i+= incrementor)
        {
            ctx.moveTo(i, 0);
            ctx.lineTo(i, h);
        }
        ctx.stroke();
        ctx.closePath();

    }

    renderAudio( array = [])
    {
        if (this.mute) { return array; }
        for (let i=0; i<this.audioClips.length; i++)
        {
            const c = this.audioClips[i];
            const sampleRate = 48000;
            const startIndex = Math.round(c.startTime * sampleRate);
            const endIndex = c.audioBuffer.duration * sampleRate  +  startIndex;

            //make sure array is long enough
            while(endIndex > array.length)
            {
                array.push(0,0,0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0,0,0,  0,0,0,0,0,0,0,0,0,0,  0,0,0,0,0,0,0,0,0,0,  0,0,0,0,0,0,0,0,0,0,  0,0,0,0,0,0,0,0,0,0,  0,0,0,0,0,0,0,0,0,0,  0,0,0,0,0,0,0,0,0,0,  0,0,0,0,0,0,0,0,0,0,  0,0,0,0,0,0,0,0,0,0); 
                //push 100 each time to speed up process
            }

            for (let j=0; j<c.data.length; j++)
            {
                array[startIndex + j] += c.data[j];
                if (isNaN(c.data[j]) == true)
                {
                    console.log("nan");
                }
            }
        }
        return array;
    }
}


class DataManager {
    constructor()
    {
        this.userState = 'idle';
        this.selectedTrack = new Track(trackParentElement);
        this.tracks = [this.selectedTrack, ];
        this.selectedClip = null;
        this.bpm = 100;
        this.currentTime = 0; //in seconds
        this.currentBeat = 0;

        this.recordingStartTime = 0;
        this.recordingEndTime = 0;
    }

    set selectedTrack(track) {
        if (track == null || !(track instanceof Track)) { return;}
        this._selectedTrack = track;
    }
    get selectedTrack() { return this._selectedTrack; }


    set bpm(newBpm) {
        if (isNaN(newBpm)) { return; }
        this._bpm = newBpm;
        // beats/minute -->  (beats/minute)/60
        this._currentBeat = this.currentTime * this.bpm/60;
    }
    get bpm() { return this._bpm; }


    set currentBeat(newBeat) {
        if (isNaN(newBeat)) { return; }
        this._currentBeat = newBeat;
        this._currentTime = this._currentBeat * (1/(this.bpm/60));
    }
    get currentBeat() { return this._currentBeat; }


    set currentTime(newTime) {
        if (isNaN(newTime)) { return;}
        this._currentTime = newTime;
        this._currentBeat = this._currentTime * this.bpm/60;
    }
    get currentTime() { return this._currentTime;}


    addAudioClip(blob, startTime) {
        if (this.selectedTrack == null) { console.error("DataManager.addAudioClip(): Recorded but selectedTrack is null!"); return;}
        this.selectedTrack.addAudioClip(blob, startTime);
    }

    createTrack()
    {
        const t = new Track(trackParentElement);
        this.tracks.push(t);
        this.selectTrack(t);
    }

    renderAudio()
    {
        let array = [];
        for (let i=0; i<this.tracks.length; i++)
        {
            array = this.tracks[i].renderAudio(array);
        }
        return array;
    }
}



var mediaRecorder;
var chunks = [];
const audioCtx = new AudioContext();

if (navigator.mediaDevices) {
    try {
        navigator.mediaDevices.getUserMedia({ "audio": true }).then((stream) => {
        
            const microphone = audioCtx.createMediaStreamSource(stream);

            // Instantiate the media recorder.
            mediaRecorder = new MediaRecorder(stream);

            mediaRecorder.onstop = () => {

                let deltaTime = new Date().getTime()/1000 - dm.recordingStartTimeStamp;
                dm.currentTime += deltaTime;
                console.log("Ending recording. endingTime: " + dm.currentTime);
            
                let blob = new Blob(chunks, { "type": "audio/ogg; codecs=opus" });
                chunks = []; // clear buffer
                
                //this.selectedTrack.addAudioClip(blob, startTime);
                dm.addAudioClip(blob, dm.recordingStartTime);
            }


            mediaRecorder.ondataavailable = (event) => {
                chunks.push(event.data);
            }
        }
    )}
    catch(error)
    {
        console.error("Critical: Unable to access microphone.");
    }
} else {
   console.error("Critical: Unable to access media devices.");
}


async function startRecording() {
    if (mediaRecorder == null) {
        console.error("startRecording(): mediaRecorder is null");
        return;
    }
    if (mediaRecorder.state != "inactive") {
        console.error("startRecording(): mediaRecorder.state is NOT inactive");
        return;
    }
    dm.recordingStartTime = dm.currentTime;
    dm.recordingStartTimeStamp = new Date().getTime()/1000;
    console.log("Starting recording. recordingStartTime: " + dm.recordingStartTime);
    mediaRecorder.start();
}
  
async function stopRecording() {
    if (mediaRecorder == null) {
        console.error("stopRecording() error - mediaRecorder is null");
    }
    //see mediaRecorder.onStop() promise function
    mediaRecorder.stop();
}

function play() {
    let array = dm.renderAudio();
    console.log(array);
    const ab = audioCtx.createBuffer(1, array.length, 48000);
    const channel1 = ab.getChannelData(0);

    for (let i=0; i<array.length; i++)
    {
        channel1[i] = array[i];
    }
    console.log("arr Len: " + array.length + "   t: " + array.length/48000);

    //ab.copyToChannel( new Float32Array(array), 0);

    const source = audioCtx.createBufferSource();
    source.buffer = ab;
    source.connect(audioCtx.destination);
    source.start();
    source.onended = () => {
        console.log("ended");
    }
}




const trackParentElement = document.getElementById("trackContainer");
const dm = new DataManager();
let pixelsPerSecond = 100;


setInterval( update, 100 );


function update()
{
    //render each track
    const tracks = dm.tracks;
    for (let i=0; i<tracks.length; i++)
    {
        tracks[i].render(pixelsPerSecond, dm.bpm);
    }

}