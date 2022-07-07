
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
            <input type="range" min="0" max="1" value="0.9" step="0.01" class="trackHeaderVolume" id="trackVolume_#"/>
        </div>
        <div class="trackBody" id="trackBody_#">
            <canvas class="trackCanvas" id="trackCanvas_#">
            </canvas>
        </div>
    </div>
`;



class Effect
{
    constructor()
    {
        const listItem = `
        <div class="effectsListItem">
            Gain
        </div>
        `;
    }
    applyToArray(x = [])
    {
        if (x.length < 1000) { return; }
        
        const length = 10;
        let pVals = new Array(length);
        for(let i=0; i<length; i++)
        {
            pVals[i] = 0;
        }

        for (let i=0; i<5; i++) {
            let pValItr = 0;
            let val = 0;
            let avg = 0;

            for (let n=length+10; n<x.length; n++)
            {
                x[n-length] = avg/length;
                val = pVals[pValItr];
                pVals[pValItr] = x[n];
                pValItr += 1;
                avg -= val;
                avg += x[n];
                if (pValItr >= length)
                {
                    pValItr = 0;
                }
            }
        }

    }
}






class Clip
{
    constructor(blob, arrayBuffer, audioBuffer, data, avgData, startTime, isTempClip = false)
    {
        //this.blob = blob;
        //this.arrayBuffer = arrayBuffer;
        this.audioBuffer = audioBuffer;
        this.data = data;
        this.averageData = avgData;

        this.startTime = startTime;
        this.durationTime = audioBuffer.duration;

        //used for rendering & playing only the section of audio that is needed (in case we clip the track)
        this.sampleRate = audioBuffer.sampleRate;
        this.trimSamplesStart = 0;
        this.trimSamplesEnd = 0;
        this.startSample = Math.round(this.sampleRate * startTime);
        this.duration = data.length;

        this.isTempClip = isTempClip;
    }
}


class Track
{
    constructor(parentElement)
    {
        if (parentElement == null) { throw "Track(): parentElement cannot be null."; }

        this.id = Math.round(Math.random() * 1000000);

        //create and name track elements
        //parentElement. += trackTemplate;

        let el = document.createElement("div");
        el.innerHTML = trackTemplate;
        parentElement.appendChild(el);

        this._initHTMLElements(this);

       
        this.mute = false;
        this.solo = false;
        this.edited = true; //boolean letting us know if we need to recompile the audio or not

        this.audioClips = [];
    }
    _initHTMLElements(selfObject) {
        let elementIDs =["trackName_", "trackMuteButton_", "trackSoloButton_", "trackVolume_", "trackCanvas_", "trackParent_", "trackBody_"];
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

        this.trackBodyElement = document.getElementById("trackBody_"+this.id);

        this.trackVolumeElement = document.getElementById("trackVolume_"+this.id);
    }

    /** @param {boolean} val */
    set mute(val) {
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
    getClipInfoAtLocalPos(pos)
    {
        //pos must be instance of Point, or have attribute .x
        //pos is the pixel pos relative to the upper lefthand of canvas

        if (!(pos.y < 0 || pos.y > this.canvasElement.height))
        {

        
            for (let i=0; i<this.audioClips.length; i++)
            {
                const c = this.audioClips[i];
                //const startX = c.startTime * this.timeToPixelMultiplier;
                //const endX = startX + c.audioBuffer.duration * this.timeToPixelMultiplier;
                const startX = (c.startSample + c.trimSamplesStart - this.sampleOffset) * this.sampleToPixelMultiplier;
                const endX = (c.startSample + c.duration - c.trimSamplesEnd - this.sampleOffset) * this.sampleToPixelMultiplier;

                if (startX <= pos.x && endX >= pos.x)
                {
                    return ({
                        clip: c,
                        pixelsToClipStart: pos.x - startX,
                        pixelsToClipEnd: endX - pos.x,
                        clipSample: pos.x*this.pixelToSampleMultiplier - c.startSample + this.sampleOffset,
                        sample: pos.x*this.pixelToSampleMultiplier + this.sampleOffset,
                    });
                }
            }   

        }

        return ({
            clip: null,
            pixelsToClipStart: 1000000,
            pixelsToClipEnd: 1000000,
        });
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
                    avg = avg*0.999 + Math.abs(data[i])*0.001;
                    averageData.push(avg);
                }

                selfObject.audioClips.push(new Clip(blob, buffer, audioBuffer, data, averageData, startTime));
                selfObject.edited = true;
            });
        });
    }
    deleteAudioClip(clip)
    {
        for(let i=0; i<this.audioClips.length; i++)
        {
            if (this.audioClips[i] == clip)
            {
                this.audioClips.splice(i,1);
                this.edited = true;
                return;
            }
        }
    }
    addAudioClipObj(clip)
    {
        if ( !(clip instanceof Clip ) )
        {
            console.error("Track.addAudioClipObj(): Audio clip must be of type Clip");
            return;
        }
        this.audioClips.push(clip);
        this.edited = true;
    }
    render(numPixelsPerSecond = 100, bpm = 100, sampleRate = 44100, sampleOffset = 0, selectedTrack, selectedClip) {

        if (this.edited == false && (this != selectedTrack || recording == false))
        {
            return;
        }
        this.edited = false;

        this.canvasElement = document.getElementById("trackCanvas_" + this.id);
        const bb = this.canvasElement.getBoundingClientRect();
        const w = Math.round(bb.width);
        const h = Math.round(bb.height);
        this.canvasElement.width = w;
        this.canvasElement.height = h;
        const ctx = this.canvasElement.getContext("2d");
        ctx.clearRect(0,0,w,h);

        if (this == selectedTrack)
        {
            ctx.fillStyle = "#9999FF11";
            ctx.fillRect(0,0,w,h);
        }

        const timeToPixelMultiplier = numPixelsPerSecond;
        const sampleToPixelMultiplier = 1/sampleRate * timeToPixelMultiplier;
        const pixelToSampleMultiplier = 1/sampleToPixelMultiplier;
        const yMultiplier = h/2;
        const startY = h/2;


        this.timeToPixelMultiplier = timeToPixelMultiplier;
        this.sampleToPixelMultiplier = sampleToPixelMultiplier;
        this.pixelToSampleMultiplier = pixelToSampleMultiplier;
        this.bpm = bpm;
        this.sampleRate = sampleRate;
        this.sampleOffset = sampleOffset;


        //draw each audio clip
        for(let i=0; i<this.audioClips.length; i++)
        {
            const c = this.audioClips[i];
            const data = c.averageData;

            //get the start and end samples required...
            let startSample = c.trimSamplesStart + c.startSample;
            const endSample = c.startSample + c.duration - c.trimSamplesEnd;

            

            //set colors
            ctx.fillStyle = "#6666FF66";
            ctx.strokeStyle = "#FF6666";
            if (c == selectedClip)
            {
                ctx.fillStyle = "#7777FF77";
            }

            //convert to pixels & draw rect
            const startPixel = startSample * sampleToPixelMultiplier;
            const endPixel = endSample * sampleToPixelMultiplier;
            ctx.fillRect(startPixel - sampleOffset*sampleToPixelMultiplier, 0, endPixel - startPixel, h);


            let yVal;
            let sampleIndex;
            let xVal;

            if ((startSample - sampleOffset)*sampleToPixelMultiplier < 0) //ensure we aren't drawing lines off the screen
            {
                startSample = sampleOffset;
            }

            ctx.beginPath();
            for (let j=startSample; j<endSample; j+=pixelToSampleMultiplier)
            {
                if (j*sampleToPixelMultiplier >= w)
                {
                    break;
                }
                
                sampleIndex = Math.round(j - c.startSample);
                yVal = data[sampleIndex]*yMultiplier + 1;
                xVal = Math.round((j - sampleOffset)*sampleToPixelMultiplier);
                ctx.moveTo(xVal, startY + yVal);
                ctx.lineTo(xVal, startY - yVal);
            }
            ctx.closePath();
            ctx.stroke();
        }

        //draw beat lines
        // beats/second * pixel/second
        let incrementor = 1/(bpm/60) * timeToPixelMultiplier; //incrementor in pixels
        let beatIncrement = 1;
        while (incrementor < 40)
        {
            incrementor *= 2;
            beatIncrement *= 2;
        }
        while (incrementor > 80)
        {
            incrementor /= 2;
            beatIncrement /= 2;
        }
        
        let incrementor2 = incrementor/2;
        let incrementor4 = incrementor/4;
        let incrementor8 = incrementor/8;
        ctx.strokeStyle="#FFFFFF44";
        ctx.fillStyle = "#999999";
        let startIndex = -sampleOffset*sampleToPixelMultiplier;
        let beat = 0;
        
        for(let i=startIndex; i<w; i+= incrementor)
        {
            ctx.moveTo(i, 12);
            ctx.lineTo(i, h);
            ctx.fillText(beat, i-2, 10);
            beat += beatIncrement;
        }
        ctx.stroke();
        ctx.strokeStyle="#FFFFFF33";
        for (let i=startIndex + incrementor2; i<w; i+= incrementor)
        {
            ctx.moveTo(i, 10);
            ctx.lineTo(i, h-10);
        }

        ctx.stroke();
        ctx.strokeStyle="#FFFFFF22";
        for (let i=startIndex + incrementor4; i<w; i+= incrementor2)
        {
            ctx.moveTo(i, 15);
            ctx.lineTo(i, h-15);
        }
        ctx.stroke();
        ctx.strokeStyle="#FFFFFF11";
        for (let i=startIndex + incrementor8; i<w; i+= incrementor4)
        {
            ctx.moveTo(i, 20);
            ctx.lineTo(i, h-20);
        }
        ctx.stroke();

        ctx.closePath();

    
    }
    getAudio( array = [], sampleRate)
    {
        if (this.mute) { return array; }

        //find required array length
        let lastSample = 0;
        let c;
        for (let i=0; i<this.audioClips.length; i++)
        {
            c = this.audioClips[i];
            lastSample = Math.max( lastSample,  c.startSample + c.duration - c.trimSamplesEnd  );
        }
        lastSample += sampleRate;

        //create temp array and fill with values...
        let temp = new Array(lastSample);
        for (let i=0; i<lastSample; i++)
        {
            temp[i] = 0;
        }

        //load each clip into the temp array
        for (let i=0; i<this.audioClips.length; i++)
        {
            const c = this.audioClips[i];
            const startIndex = Math.round(c.startTime * sampleRate);
            const endIndex = c.audioBuffer.duration * sampleRate  +  startIndex;

            const localStartIndex = c.trimSamplesStart;
            const localEndIndex = c.duration - c.trimSamplesEnd;
            const globalStartIndex = c.startSample + localStartIndex;
            const globalEndIndex = c.startSample + localEndIndex;

            let localItr = Math.round(localStartIndex);
            let globalItr = Math.round(globalStartIndex);
            for (let i=0; i<localEndIndex-localStartIndex; i++)
            {
                temp[globalItr] += c.data[localItr];
                localItr++;
                globalItr++;
            }
        }

        //Apply effects
        //TODO
        const effect = new Effect();
        effect.applyToArray(temp);


        //Add to passed array "array"
        let volume = Number(this.trackVolumeElement.value);
        if (isNaN(volume)) { volume = 1;}
        for (let i=0; i<lastSample; i++)
        {
            array[i] += temp[i] * volume;
        }


        return array;
    }
}


class DataManager {
    constructor()
    {
        this.state = 'idle';
        this.sampleRate = 44100;
        this.trackContainer; // set in _initEventHandler
        this.selectedTrack = new Track(trackParentElement);
        this.tracks = [this.selectedTrack, ];
        this.selectedClip = null;
        this.bpm = 100;
        this.beatsPerMeasure = 4;
        this.currentTime = 0; //in seconds
        this.currentBeat = 0;

        this.recordingStartTime = 0;
        this.recordingEndTime = 0;


        this.globalMousePos = new Point();
        this.localMousePos = new Point();
        this.deltaMousePos = new Point();
        this.clickDist = 10;


        this.sampleToPixelMultiplier;// = 1/this.sampleRate * this.timeToPixelMultiplier;
        this.pixelToSampleMultiplier;// = 1/sampleToPixelMultiplier;
        this.timeToPixelMultiplier = 100;

        //for scrolling horizontally...
        this.maxNumSamples = 1 * 60 * this.sampleRate; //5 minutes
        this.sampleOffset = 0;


        this._initEventHandler(this);
    }
    set selectedTrack(track) {
        if (track == null || !(track instanceof Track)) { return;}
        this._selectedTrack = track;
    }
    get selectedTrack() { return this._selectedTrack; }
    set bpm(newBpm) {
        if (isNaN(newBpm)) { return; }
        this._bpm = newBpm;
        this._bps = newBpm/60;
        // beats/minute -->  (beats/minute)/60
        this._currentBeat = this.currentTime * this.bpm/60;
    }
    get bpm() { return this._bpm; }
    get bps() {
        return this._bps;
    }
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

    set timeToPixelMultiplier(newVal)
    {
        this._timeToPixelMultiplier = newVal;
        this.sampleToPixelMultiplier = 1/this.sampleRate * this._timeToPixelMultiplier;
        this.pixelToSampleMultiplier = 1/this.sampleToPixelMultiplier;
    }
    get timeToPixelMultiplier() { return this._timeToPixelMultiplier; }

    _initEventHandler(selfObject)
    {
        this.trackContainer = document.getElementById("trackContainer");
        ["keypressed", "keyreleased","click", "drag","mousedown", "mousemove", "mouseup", "mousedrag"].forEach(function(event)
        {
            selfObject.trackContainer.addEventListener(event, function(e) {
                selfObject.eventHandler(e);
            });
        });

        //Key listeners have to be called by external functoins... FUCK.
    }
    eventHandler(event)
    {
        if (event == null)
        {
            console.error("event == null.");
            return;
        }

        //Variables set my data handlers... user later in state logic
        let globalMousePos;
        let localMousePos;
        let deltaMousePos;
        let track;
        let canvas;
        let clip;
        let clipSample; // used for offset when dragging clip. represents the sample clicked within the clip
        let pixelsToClipStart = 1000000;
        let pixelsToClipEnd = 1000000;
        let keyPressed;
        let keyReleased;
        let keyPressedRaw;
        let keyReleasedRaw;
        let key;
        let keyRaw;

        //Get data from mouse event
        if (["mousedown", "mouseup", "mousemove", "mousedrag", "drag", "click"].includes(event.type))
        {
            globalMousePos = new Point(event.clientX, event.clientY);
            deltaMousePos = globalMousePos.sub(this.globalMousePos);
            this.globalMousePos = globalMousePos;
            
            //get track & canvas over
            for (let i=0; i<this.tracks.length; i++)
            {
                const t = this.tracks[i];
                const bb = t.canvasElement.getBoundingClientRect();
                if (bb.left <= globalMousePos.x && bb.right >= globalMousePos.x &&
                    bb.top <= globalMousePos.y && bb.bottom >= globalMousePos.y)
                {
                    localMousePos = new Point(event.clientX-bb.left, event.clientY-bb.top);
                    this.localMousePos = localMousePos;
                    track = this.tracks[i];
                    canvas = track.canvasElement;
                    let ret = track.getClipInfoAtLocalPos(localMousePos);
                    clip = ret.clip;
                    pixelsToClipStart = ret.pixelsToClipStart;
                    pixelsToClipEnd = ret.pixelsToClipEnd;
                    clipSample = ret.clipSample;
                    //sample = ret.sample;
                    break;
                }
            }
        }

        document.getElementById("currentStateTextBox").innerHTML = this.state;

        //get data from key event
        if (event.type == "keydown")
        {
            keyPressed = event.key.toLowerCase();
            keyPressedRaw = event.key.toLowerCase();
            key = keyPressed;
            keyRaw = keyPressedRaw;
        }
        if (event.type == "keyup")
        {
            keyReleased = event.key.toLowerCase();
            keyReleasedRaw = event.key.toLowerCase();
            key = keyReleased;
            keyRaw = keyReleasedRaw;
        }
        if (keyPressed == "escape")
        {
            this.state == "idle";
            return;
        }

        //Set cursor style (if over canvas & such)
        if (track != null)
        {
            if (clip != null){
                let a = pixelsToClipEnd < this.clickDist;
                let b = pixelsToClipStart < this.clickDist;
                if ( ((a && !b) || (!a && b)) && this.state != "draggingClip")
                {
                    track.canvasElement.style.cursor = "e-resize"; 
                } else {
                    track.canvasElement.style.cursor = "pointer"; 
                }
            } else {
                track.canvasElement.style.cursor = "default";   
            }
        }


        //States Logic
        if (this.state == "idle")
        {
            if (event.type == "click")
            {
                writeHeadChanged({type: "mousedown"});
                writeHeadChanged({type: "mousemove", clientX: event.clientX});
                writeHeadChanged({type: "mouseup"});
            }
            if (event.type == "mousedown" && clip != null)
            {
                console.log("dragging or clipping...");
                this.selectedClip = clip;
                this.selectedTrack = track;
                this.selectedCanvas = canvas;
                this.draggingClipClipSample = clipSample;
                if (pixelsToClipStart < this.clickDist && pixelsToClipEnd < this.clickDist)
                {
                    this.state = "draggingClip";
                } else if (pixelsToClipStart < this.clickDist)
                {
                    this.state = "draggingClipStart";
                } else if (pixelsToClipEnd < this.clickDist)
                {
                    this.state = "draggingClipEnd";
                } else {
                    this.state = "draggingClip";
                }
                return;
            }
            if ((event.type == "mousedown" || event.type == "click") && track != null)
            {
                this.selectedTrack = track;
                this.selectedClip = clip;
                return;
            }
            if (event.type == "keydown" && keyPressed == "backspace" && this.selectedTrack != null && this.selectedClip != null)
            {
                this.selectedTrack.deleteAudioClip(this.selectedClip);
            }
            if (event.type == "keydown" && (keyPressed == "enter" || keyPressed == "return"))
            {
                if (playing)
                {
                    stop();
                }
                if (recording)
                {
                    stopRecording();
                }

                writeHeadChanged(null, true);
                scrollBarChanged(null, true);
            }
            if (event.type == "keydown" && (keyPressed == "space" || keyPressed == " "))
            {
                if (recording)
                {
                    stopRecording();
                }
                if (playing)
                {
                    stop();
                } else {
                    play();
                }
            }
            if (event.type == "keydown" && (keyPressed == "r"))
            {
                if (recording)
                {
                    stopRecording();
                } else {
                    startRecording();
                }
            }
        }

        if (this.state == "draggingClip")
        {
            this.selectedTrack.edited = true;
            if (event.type == "mouseup" || writeHead_mouseIsDown == true)
            {
                this.state = "idle";
                return;
            }

            //const timeToPixelMultiplier = numPixelsPerSecond;
            //const sampleToPixelMultiplier = 1/this.sampleRate * this.timeToPixelMultiplier;
            //const pixelToSampleMultiplier = 1/sampleToPixelMultiplier;
            
            const sampleAtMouse = Math.round(this.localMousePos.x * this.pixelToSampleMultiplier);
            this.selectedClip.startSample = sampleAtMouse - this.draggingClipClipSample + this.sampleOffset;
        }

        if (this.state == "draggingClipEnd")
        {
            this.selectedTrack.edited = true;
            if (event.type == "mouseup" || writeHead_mouseIsDown == true)
            {
                this.state = "idle";
                return;
            }
            //const sampleToPixelMultiplier = 1/this.sampleRate * this.timeToPixelMultiplier;
            //const pixelToSampleMultiplier = 1/sampleToPixelMultiplier;

            const endX = (this.selectedClip.startSample + this.selectedClip.duration) * this.sampleToPixelMultiplier;

            let pVal = this.selectedClip.trimSamplesEnd;
            this.selectedClip.trimSamplesEnd = Math.max(0, (endX - localMousePos.x) * this.pixelToSampleMultiplier - this.sampleOffset);

            //Make sure we don't shorten clip too far.
            if (this.selectedClip.startSample + this.selectedClip.trimSamplesStart + 100 > this.selectedClip.startSample + this.selectedClip.duration - this.selectedClip.trimSamplesEnd)
            {
                this.selectedClip.trimSamplesEnd = pVal;
            }
        }

        if (this.state == "draggingClipStart")
        {
            this.selectedTrack.edited = true;
            if (event.type == "mouseup" || writeHead_mouseIsDown == true)
            {
                this.state = "idle";
                return;
            }
            //const sampleToPixelMultiplier = 1/this.sampleRate * this.timeToPixelMultiplier;
            //const pixelToSampleMultiplier = 1/sampleToPixelMultiplier;

            const startX = this.selectedClip.startSample * this.sampleToPixelMultiplier;

            let pVal = this.selectedClip.trimSamplesStart;
            this.selectedClip.trimSamplesStart = Math.max(0, (localMousePos.x-startX) * this.pixelToSampleMultiplier + this.sampleOffset);

            //Make sure we don't shorten clip too far.
            if (this.selectedClip.startSample + this.selectedClip.trimSamplesStart + 100 > this.selectedClip.startSample + this.selectedClip.duration - this.selectedClip.trimSamplesEnd)
            {
                this.selectedClip.trimSamplesStart = pVal;
            }

        }


    }
    render()
    {   
        for (let i=0; i<this.tracks.length; i++)
        {
            this.tracks[i].render(this.timeToPixelMultiplier, this.bpm, this.sampleRate, this.sampleOffset, this.selectedTrack, this.selectedClip);
        }
    }
    refreshAllTracks()
    {
        for (let i=0; i<this.tracks.length; i++)
        {
            this.tracks[i].edited = true;
        }
    }

    setScrollPercentage(percent)
    {
        //this.maxNumSamples
        //this.timeToPixelMultiplier = 100;
        percent = Math.max(0, Math.min(1, percent))
        this.sampleOffset = this.maxNumSamples * percent;
    }

    addAudioClip(blob, startTime) {
        if (this.selectedTrack == null) { console.error("DataManager.addAudioClip(): Recorded but selectedTrack is null!"); return;}
        this.selectedTrack.addAudioClip(blob, startTime);
    }
    createTrack()
    {
        const t = new Track(trackParentElement);
        this.tracks.push(t);
    }
    getAudio()
    {
        //First, find how long of an array we'll need to hold all of the clips
        let lastSample = 1000;
        for (let i=0; i<this.tracks.length; i++)
        {
            //array = this.tracks[i].getAudio(array, this.sampleRate);
            for (let j=0; j<this.tracks[i].audioClips.length; j++)
            {
                const c = this.tracks[i].audioClips[j];
                lastSample = Math.max( lastSample,  c.startSample + c.duration - c.trimSamplesEnd );
            }
        }
        lastSample += this.sampleRate; //Add 1 extra second to the end...

        //initialize the array
        const array = new Array(lastSample);
        for (let i=0; i<lastSample; i++)
        {
            array[i] = 0;
        }

        //load audio into array from each track
        for (let i=0; i<this.tracks.length; i++)
        {
            this.tracks[i].getAudio(array, this.sampleRate);
        }
        
        return array;
    }
}



var mediaRecorder;
var chunks = [];
const audioCtx = new AudioContext();

var trackParentElement = document.getElementById("trackContainer");
var dm = new DataManager();
var tempAudioClip;          //used for when recording... - create a dummy audio clip for graphics only
var recording = false;      //boolean used for remembering if we're currently recording (set in start/stop recording() )
var playing = false;
const updateDelay = 50;

//for horizontal scroll bar functionality
const scrollBar_ParentElement = document.getElementById("trackScrollbarContainer");
const scrollBar_SliderElement = document.getElementById("trackScrollbarSlider");
document.addEventListener("mousemove", scrollBarChanged);
document.addEventListener("mouseup", scrollBarChanged);
var scrollBar_mouseIsDown = false;
var scrollBar_mouseLeftOffset = 0;
var scrollBarSampleOffset = 0;
var scrollBarPixelOffset = 0;

//for write head
const writeHeadElement = document.getElementById("writeHeadElement");
var writeHead_mouseIsDown = false;
var writeHead_updateInverval = null; //used for updating the scroll bar when dragging..
var writeHeadSampleOffset = 0;
document.addEventListener("mousemove", writeHeadChanged);
document.addEventListener("mouseup", writeHeadChanged);

//For key listener - essentially just passes keyup and keydown events to the DataManager
document.addEventListener("keydown", keyListener);
document.addEventListener("keyup", keyListener);
function keyListener(event) { dm.eventHandler(event);}


//for playing...
var audioBufferSourceNode = audioCtx.createBufferSource();


//Setup media devices...
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



//Button handlers
async function startRecording() {
    if (mediaRecorder == null) {
        console.error("startRecording(): mediaRecorder is null");
        return;
    }
    if (mediaRecorder.state != "inactive") {
        console.error("startRecording(): mediaRecorder.state is NOT inactive");
        return;
    }
    dm.currentTime = writeHeadSampleOffset / dm.sampleRate;
    dm.recordingStartTime = dm.currentTime;
    dm.recordingStartTimeStamp = new Date().getTime()/1000;
    //console.log("Starting recording. recordingStartTime: " + dm.recordingStartTime);
    mediaRecorder.start();

    let fakeAudioBuffer = {
        duration: 0,
        sampleRate: 44100,
    }
    tempAudioClip = new Clip(null, null, fakeAudioBuffer, [0,0,0,0,0], [0,0,0,0,0,0], dm.currentTime, true);
    dm.selectedTrack.addAudioClipObj(tempAudioClip);
    recording = true;
}
  
async function stopRecording() {
    if (mediaRecorder == null) {
        console.error("stopRecording() error - mediaRecorder is null");
    }
    if (mediaRecorder.state == "inactive")
    {
        console.log("Cannot stop. Not recording.");
        return;
    }
    //see mediaRecorder.onStop() promise function
    mediaRecorder.stop();
    dm.selectedTrack.deleteAudioClip(tempAudioClip);
    recording = false;
}


function play() {

    if (playing == true && audioBufferSourceNode != null)
    {
        console.log("already playing - stopping");
        stop();
        audioBufferSourceNode = null;
        
    }

    //we if audioBufferSourceNode is null, create a new one!
    //NOTE: also, if the buffer is not null, delete the old node and replace it with a new one
    if (audioBufferSourceNode == null ||  audioBufferSourceNode.buffer != null)
    {
        audioBufferSourceNode = audioCtx.createBufferSource();
    }


    //Get array
    let array = dm.getAudio();
    if (array.length < 100)
    {
        return;
    }
    const ab = audioCtx.createBuffer(1, array.length, dm.sampleRate);
    const channel1 = ab.getChannelData(0);

    for (let i=0; i<array.length; i++)
    {
        channel1[i] = array[i];
    }

    dm.currentTime = writeHeadSampleOffset / dm.sampleRate;
    dm.playingStartTime = dm.currentTime;
    dm.playingStartTimeStamp = new Date().getTime()/1000;
    playing = true;
    //const audioBufferSourceNode = audioCtx.createBufferSource();
    audioBufferSourceNode.buffer = ab;
    audioBufferSourceNode.connect(audioCtx.destination);
    audioBufferSourceNode.start(0,dm.currentTime);
    audioBufferSourceNode.onended = () =>
    {
        playing = false;
        console.log("done playing");
    }
}
function stop() {
    if (playing == true)
    {
        audioBufferSourceNode.stop();
        playing = false;
    }
}


function addTrack() {
    dm.createTrack();
    dm.refreshAllTracks();
}



//For scrolling horizontally in the canvases
function scrollBarChanged(event, setToZero = false, adjust = 0)
{
    let updateTracks = false;
    let percentage = 0;
    if (setToZero)
    {
        scrollBar_SliderElement.style.left = "0px";
        updateTracks = true;
    }
    if (adjust != 0)
    {
        let left = scrollBar_SliderElement.style.left;
        left = left.replace("px", "");
        left = Number(left);
        if (isNaN(left)) { console.error("left is NaN");}
        
        left += adjust;
        let bb = scrollBar_ParentElement.getBoundingClientRect();
        let bb2 = scrollBar_SliderElement.getBoundingClientRect();
        left = Math.min(Math.max(0, left), (bb.width - bb2.width));
        scrollBar_SliderElement.style.left = left + "px";
        percentage =  left / (bb.width - bb2.width);
        updateTracks = true;
    }
    if (event != null && event.type == "mousedown")
    {
        scrollBar_mouseIsDown = true;
        scrollBar_mouseLeftOffset  = event.offsetX;
    }
    if (event != null && event.type == "mouseup")
    {
        scrollBar_mouseIsDown = false;
    }
    if (scrollBar_mouseIsDown == true && event != null && event.type == "mousemove")
    {
        //first, move the scrollbar slider and compute the percentage of the way it's scrolled
        let bb = scrollBar_ParentElement.getBoundingClientRect();
        let bb2 = scrollBar_SliderElement.getBoundingClientRect();
        let mousePos = new Point(event.clientX, event.clientY);
        let left = Math.round(mousePos.x - scrollBar_mouseLeftOffset - bb.left);
        left = Math.min(left, (bb.width - bb2.width));
        left = Math.max(0, left);

        scrollBar_SliderElement.style.left = left + "px";
        percentage =  left / (bb.width - bb2.width);
        updateTracks = true;
    }
    if (updateTracks)
    {
        const pixelOffset = percentage * 1000;
        scrollBarPixelOffset = pixelOffset;
        scrollBarSampleOffset = pixelOffset * dm.pixelToSampleMultiplier;
        for (let i=0; i<dm.tracks.length; i++)
        {
            const t= dm.tracks[i];
            const element = document.getElementById("trackBody_"+t.id);
            element.scrollLeft = percentage * 1000 ;
        }
    }
}


//For moving the write head
function writeHeadChanged(event = {type: "update", clientX: -1000,}, setToZero = false, wantedSampleOffset = null)
{
    //writeHeadElement = document.getElementById("writeHeadElement");
    let wantedLeftRelativePos_pixels = null;
    let wantedPosIncludingScrollBar_samples = null;
    const bb = writeHeadElement.getBoundingClientRect();
    const trackBodyElement = document.getElementById("trackBody_"+dm.tracks[0].id);
    const trackBodyBB = trackBodyElement.getBoundingClientRect();

    //ensure event has a type...
    if (event == null)
    {
        event = {
            type: "none",
        }
    }

    //if we want to set it to zero...
    if (setToZero)
    {
        wantedPosIncludingScrollBar_samples = 0;
        scrollBarPixelOffset = 0;
    }

    //if we want to set it to a specific sample position, taking into account scrollbar offset.
    if (wantedSampleOffset != null)
    {
        wantedPosIncludingScrollBar_samples = wantedSampleOffset;
    }

    if (event.type == "mousedown")
    {
        writeHead_mouseIsDown = true;
    }
    if (event.type == "mouseup")
    {
        writeHead_mouseIsDown = false;
    }
    if (writeHead_mouseIsDown == true && event.type == "mousemove")
    {
        wantedLeftRelativePos_pixels = event.clientX - trackBodyBB.left;
    }

    if (wantedLeftRelativePos_pixels != null)
    {
        //adjust mouse pos to fit within trachBody Box, (relative to trackBodyBB.left)
        wantedLeftRelativePos_pixels = Math.max(0, Math.min(trackBodyBB.width, wantedLeftRelativePos_pixels));

        //include offset due to scrollBar
        let wantedPosIncludingScrollBar_pixels = wantedLeftRelativePos_pixels + scrollBarPixelOffset;
        wantedPosIncludingScrollBar_samples = wantedPosIncludingScrollBar_pixels * dm.pixelToSampleMultiplier;
    }
    if (wantedPosIncludingScrollBar_samples != null)
    {
        //round to nearest eigth beat
        const eigthBeatLength_samples = (1/dm.bps) * (dm.sampleRate) / 8//sample/beat = seconds/beat * sample/second
        wantedPosIncludingScrollBar_samples = Math.round(wantedPosIncludingScrollBar_samples / eigthBeatLength_samples) * eigthBeatLength_samples;
        wantedPosIncludingScrollBar_pixels = wantedPosIncludingScrollBar_samples / dm.pixelToSampleMultiplier;

        writeHeadSampleOffset = wantedPosIncludingScrollBar_samples;

        //remove scrollBarPixelOffset
        wantedLeftRelativePos_pixels = wantedPosIncludingScrollBar_pixels - scrollBarPixelOffset;

        //saveSampleOffset...
        //writeHeadSampleOffset = wantedLeftRelativePos_pixels * dm.pixelToSampleMultiplier;

        //finally, set writeHeadElement position.
        writeHeadElement.style.left = Math.round(wantedLeftRelativePos_pixels + trackBodyBB.left) + "px";
    }
}


//for zooming in & out...
function zoomIn()
{
    dm.timeToPixelMultiplier *= 1.2;
    dm.refreshAllTracks();
    writeHeadChanged(null, false, writeHeadSampleOffset);
}
function zoomOut()
{
    dm.timeToPixelMultiplier *= 0.8;
    dm.refreshAllTracks();
    writeHeadChanged(null, false, writeHeadSampleOffset);
}


scrollBarChanged(null,false,0);
writeHeadChanged(null,true);
setInterval( update, updateDelay );


function update()
{
    //render each track
    dm.render();

    if (recording == true)
    {
        //make the tempClip longer for the recording animation...
        tempAudioClip.duration = tempAudioClip.sampleRate * ( new Date().getTime()/1000 - dm.recordingStartTimeStamp  );

        //updateDelay is in milliseconds.

        //we want to make sure the current sample is always in the center of the screen while recording...
        /*const currentWantedSample = tempAudioClip.duration + tempAudioClip.startSample;
        const writeHeadSample = writeHeadSampleOffset + scrollBarSampleOffset;
        const difference = writeHeadSample - currentWantedSample;
        console.log(difference/dm.sampleRate);
        scrollBarChanged(null, false, -100 * difference/dm.sampleRate);*/
    }

    if (recording == true)
    {
        const currentWantedSample = tempAudioClip.duration + tempAudioClip.startSample;
        writeHeadChanged(null, false, currentWantedSample);
    }
    if (playing == true)
    {
        //dm.playingStartTime = dm.currentTime;
        //dm.playingStartTimeStamp = new Date().getTime()/1000;

        const timeSincePlayingStarted = new Date().getTime()/1000 - dm.playingStartTimeStamp;
        const time = timeSincePlayingStarted + dm.playingStartTime;
        const sample = time * dm.sampleRate;
        writeHeadChanged(null, false, sample);
    }
}