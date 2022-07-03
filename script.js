
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
    
    addAudioClip(blob, startTime)
    {
        //take blob --> arrayBuffer --> AudioBuffer --> array
        const obj = this;
        blob.arrayBuffer().then(function (buffer) {
            audioCtx.decodeAudioData(buffer).then(function (audioBuffer) {

                let arr = audioBuffer.getChannelData(0);

                let averageData = [];
                let avg = 0;
                for (let i=0; i<arr.length; i++)
                {
                    avg = avg*0.99 + Math.abs(arr[i])*0.01;
                    averageData.push(avg);
                }

                obj.audioClips.push({
                    blob: blob,
                    arrayBuffer: buffer,
                    audioBuffer: audioBuffer,
                    data: arr,
                    averageData: averageData,
                    startTime: startTime,
                });


                /*
                let els = document.getElementsByClassName("trackCanvas");
                let e = els[0]; //get first element
                let bb = e.getBoundingClientRect();
                e.width = bb.width;
                e.height = bb.height;

                let ctx = e.getContext("2d");
                ctx.fillStyle = "#9999FF";
                ctx.fillRect(0, 0, bb.width, bb.height);

                ctx.fillStyle = "blue";
                const y0 = bb.height / 2;
                ctx.beginPath();
                ctx.moveTo(0, y0);
                for (let i = 0; i < Math.min(bb.width, arr.byteLength / 100); i++) {
                    ctx.lineTo(i, y0 - arr[i * 100] * 100);
                }
                ctx.stroke();
                ctx.closePath();*/
            });
        });
    }

    render(numPixelsPerSecond = 20) {

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

        for(let i=0; i<this.audioClips.length; i++)
        {
            const c = this.audioClips[i];
            const arr = c.averageData;
            const clipLengthSeconds = c.audioBuffer.duration;

            const startX = Math.round(c.startTime * timeToPixelMultiplier);
            const startY = Math.round(h/2);
            const yMultiplier = h/2;

            
            ctx.fillStyle = "#9999FF";
            ctx.strokeStyle = "#FF0000";

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
    }
}


class DataManager {
    constructor()
    {
        this.userState = 'idle';
        this.selectedTrack = new Track(trackParentElement);
        this.tracks = [this.selectedTrack, ];
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

            mediaRecorder.ondataavailable = (event) => {
                chunks.push(event.data);
            }

            
            mediaRecorder.onstop = () => {
                let blob = new Blob(chunks, { "type": "audio/ogg; codecs=opus" });
                chunks = []; // clear buffer

                
                //this.selectedTrack.addAudioClip(blob, startTime);
                dm.addAudioClip(blob, dm.recordingStartTime);

                /*
                //take blob --> arrayBuffer --> AudioBuffer --> array
                blob.arrayBuffer().then(function (buffer) {
                    audioCtx.decodeAudioData(buffer).then(function (audioBuffer) {
                        let arr = audioBuffer.getChannelData(0);
                        let els = document.getElementsByClassName("trackCanvas");
                        let e = els[0]; //get first element
                        let bb = e.getBoundingClientRect();
                        e.width = bb.width;
                        e.height = bb.height;

                        let ctx = e.getContext("2d");
                        ctx.fillStyle = "#9999FF";
                        ctx.fillRect(0, 0, bb.width, bb.height);

                        ctx.fillStyle = "blue";
                        const y0 = bb.height / 2;
                        ctx.beginPath();
                        ctx.moveTo(0, y0);
                        for (let i = 0; i < Math.min(bb.width, arr.byteLength / 100); i++) {
                            ctx.lineTo(i, y0 - arr[i * 100] * 100);
                        }
                        ctx.stroke();
                        ctx.closePath();
                    });
                });*/
            }

            // One of many ways to use the blob
            /*const audio = new Audio();
            const audioURL = window.URL.createObjectURL(blob);
            audio.src = audioURL;
            audio.play();*/
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
    mediaRecorder.start();
}
  
async function stopRecording() {
    if (mediaRecorder == null) {
        console.error("stopRecording() error - mediaRecorder is null");
    }
    mediaRecorder.stop();
    return;
    await mediaRecorder.stop();

    console.log(mediaRecorder);
    console.log(chunks);
    if (chunks.length == 0) { return; }

    //await mediaRecorder.onstop();
    const blob = new Blob(chunks, {type: "audio/ogg; codecs=opus"});
    chunks = [];
    const arrayBuffer = await blob.arrayBuffer();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    const arr = audioBuffer.getChannelData(0);

    const els = document.getElementsByClassName("trackCanvas");
    const e = els[0]; //get first element
    let bb = e.getBoundingClientRect();
    e.width = bb.width;
    e.height = bb.height;

    let ctx = e.getContext("2d");
    ctx.fillStyle = "#9999FF";
    ctx.fillRect(0, 0, bb.width, bb.height);

    ctx.fillStyle = "blue";
    const y0 = bb.height / 2;
    ctx.beginPath();
    ctx.moveTo(0, y0);
    for (let i = 0; i < Math.min(bb.width, arr.byteLength / 100); i++) {
        ctx.lineTo(i, y0 - arr[i * 100] * 100);
    }
    ctx.stroke();
    ctx.closePath();
}






const trackParentElement = document.getElementById("trackContainer");
const dm = new DataManager();


setInterval( update, 1000 );


function update()
{
    const tracks = dm.tracks;
    for (let i=0; i<tracks.length; i++)
    {
        tracks[i].render();
    }
}