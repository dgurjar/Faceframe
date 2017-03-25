window.onload = function(){
  var defaultRows = 5;
  var defaultCols = 5;
  var defaultEnableAudio = true;
  document.getElementsByName("rows")[0].value= defaultRows;
  document.getElementsByName("cols")[0].value= defaultCols;
  document.getElementsByName("enableAudio")[0].checked = defaultEnableAudio;
  puzzle = new RectangleVideoPuzzle(defaultRows, //rows=
                                    defaultCols, //cols=
                                    defaultEnableAudio, //enableAudio=
                                    false, //enableOpacityDtEffect=
                                    false, //enableDisplayIdEffect=
                                    0, //VideoDelay=
                                    undefined //VideoSrc=
                                    );
  puzzle.start();
}

function updatePuzzle() {
  var setRows = document.getElementsByName("rows")[0].value;
  var setCols = document.getElementsByName("cols")[0].value;
  var setEnableAudio = document.getElementsByName("enableAudio")[0].checked;
  var defaultRows = (setRows == "") ? 5: setRows;
  var defaultCols = (setCols == "") ? 5: setCols;
  var defaultEnableAudio = setEnableAudio;
  // Restart the puzzle with new settings
  puzzle.restart(defaultRows, //rows=
                  defaultCols, //cols=
                  defaultEnableAudio, //enableAudio=
                  false, //enableOpacityDtEffect=
                  false, //enableDisplayIdEffect=
                  0, //videoDelay=
                  undefined //videoSrc=
                  );
}

//---------------------------------------------

// Randomly shuffles the array
Array.prototype.shuffle = function() {
  var i = this.length, j, temp;
  if ( i == 0 ) return this;
  while ( --i ) {
     j = Math.floor(Math.random()*(i+1));
     temp = this[i];
     this[i] = this[j];
     this[j] = temp;
  }
  return this;
};

// Moves an alement to a new location in this array
Array.prototype.move = function (oldIndex, newIndex) {
    if (newIndex >= this.length) {
        var k = newIndex - this.length;
        while ((k--) + 1) {
            this.push(undefined);
        }
    }
    this.splice(newIndex, 0, this.splice(oldIndex, 1)[0]);
    return this; // for testing purposes
};

// Given a list of elements, moves all elements in this list that are in the sublist to the end of this list
Array.prototype.movelistToEnd = function (sublist) {
  var append = [];
  for (var i = 0; i<this.length; i++) {
    if (sublist.lastIndexOf(this[i]) >= 0) {
      append.push(this.splice(i, 1)[0]);
    }
  }
  this.push.apply(this, append);
};

//---------------------------------------------


class VideoPuzzle {

  constructor(enableAudio=true, videoDelay=7500, videoSrc=undefined, videoWidth=640, videoHeight=480) {
    this.settings = {marginForConnection:20};

    this.state =  {
      isCompleted: false,
      isDragging: false,
      lastSelectedPiece: undefined,
      clickX: 0,
      clickY: 0
    };

    this.audio = {
      enable: enableAudio,
      background: {filename: "029-jiggywiggy-s-challenge-normal-speed-.mp3", obj: undefined},
      connection: {filename: "", obj: undefined}
    }

    this.renderIntervalId = undefined;
    this.videoSrc = videoSrc;
    this.videoWidth = videoWidth;
    this.videoHeight = videoHeight;
    this.videoStream = undefined;
    this.pieces = {};
    this.parts = {};
    this.z_order = [];
    this.startTime = 0;
    this.timeLimit = 0;
    this.canvasMargin = 50; //TODO: Utilize this

    this.videoDelay = videoDelay;

    if(!this.videoSrc) {
      this.videoElement = document.getElementById('webcam');
    }
    else {
      this.videoElement = document.getElementsByClassName('video-stream html5-main-video')[0];
    }
    this.canvasElement = document.getElementById("c");
    this.ctx = this.canvasElement.getContext("2d");
  }

  start() {
    // Make sure the initial z order of the pieces is randomized
    this.z_order.shuffle();

    // Set the time limit to equal the audio time
    var d = new Date();
    this.startTime = d.getTime();
    this.timeLimit = (this.audio.background.obj.duration*1000) + this.videoDelay;

    var puzzle = this;
    // Display the puzzle after a small delay to match with the audio
    setTimeout(function() {
      /* Update the video on the canvas on a regular interval */
      puzzle.renderIntervalId = window.setInterval(function(){puzzle.update()}, 1);
      puzzle.bindUIActions();
    }, this.videoDelay);

  }

  update() {
    if(this.videoStream){
        /* Clear the canvas */
        this.ctx.clearRect(0,0,this.canvasElement.width,this.canvasElement.height);

        /* Draw the board */
        this.drawBoard();

        /* Render all of the puzzle pieces */
        var puzzle = this;
        this.z_order.map(function(z_idx){if (puzzle.parts[z_idx]) {puzzle.parts[z_idx].render(puzzle.ctx)}});
    }
  }

  drawBoard() {
      /* Set the background to white */
      this.ctx.fillStyle = "white";
      this.ctx.fillRect(0, 0, this.canvasElement.width, this.canvasElement.height);

      // TODO: Draw the partitions for the pieces
      /*
      this.ctx.strokeStyle = "white";
      for(var i=0; i<pieceRows; i++){
          this.ctx.beginPath();
          this.ctx.moveTo(0, i*pieceHeight);
          this.ctx.lineTo(canvas.width, i*pieceHeight);
          this.ctx.stroke();

          this.ctx.beginPath();
          this.ctx.moveTo(i*pieceWidth, 0);
          this.ctx.lineTo(i*pieceWidth, canvas.height);
          this.ctx.stroke();
      }

      */
  }

  bindUIActions() {
    /* Manage mouse interactions with the puzzle
    this.canvasElement.addEventListener("mousemove", function(e){puzzle.updateSelection(e)}, false);
    this.canvasElement.addEventListener("mousedown", function(e){puzzle.beginMouseDrag(e)}, false);
    this.canvasElement.addEventListener("mouseup", function(e){puzzle.endMouseDrag(e)}, false);
    */
    this.updateSelectionRef = this.updateSelection.bind(this);
    this.beginMouseDragRef = this.beginMouseDrag.bind(this);
    this.endMouseDragRef = this.endMouseDrag.bind(this);

    this.canvasElement.addEventListener("mousemove", this.updateSelectionRef, false);
    this.canvasElement.addEventListener("mousedown", this.beginMouseDragRef, false);
    this.canvasElement.addEventListener("mouseup", this.endMouseDragRef, false);
  }

  unbindUIActions() {
    this.canvasElement.removeEventListener("mousemove", this.updateSelectionRef, false);
    vthis.canvasElement.removeEventListener("mousedown", this.beginMouseDragRef, false);
    this.canvasElement.removeEventListener("mouseup", this.endMouseDragRef, false);
  }

  updateSelection(e, puzzle) {
    // Perform actions on the selected or top-most piece only!
    var topPiece = this.state.lastSelectedPiece;
    var topPieceId;
    if (topPiece == undefined) {
      topPieceId = this.z_order[this.z_order.length-1];
      topPiece = this.pieces[topPieceId];
    }
    else {
      topPieceId = topPiece.id;
    }

    if(this.state.isDragging){
      // Move this all pieces that are in the same part as the selected pieces
      var topPart = topPiece.parentPart;
      var dx = e.offsetX - this.state.clickX - topPiece.currentPosition.x;
      var dy = e.offsetY - this.state.clickY - topPiece.currentPosition.y;
      topPart.updatePositionDelta({dx:dx, dy:dy});
    }
    else {
      var partSelectedZ = -1;
      // Traverse backwards from z-order to select the first piece
      for (var i=this.z_order.length-1; i>=0; i--) {
        var id = this.z_order[i];
        var part = this.parts[id];
        for (var j = 0; j<part.pieces.length; j++){
          var p = part.pieces[j];
          if((partSelectedZ < 0)
              && (e.offsetX > p.currentPosition.x)
              &&(e.offsetX < (p.currentPosition.x+p.currentPosition.width))
              &&(e.offsetY > p.currentPosition.y)
              &&(e.offsetY < (p.currentPosition.y+p.currentPosition.height))){
                p.isSelected = true;
                p.parentPart.isSelected = true;
                partSelectedZ = i;
                this.state.lastSelectedPiece = p;
          }
          else {
            p.isSelected = false;
            if (this.state.lastSelectedPiece && p.parentPart != this.state.lastSelectedPiece.parentPart) {
              p.parentPart.isSelected = false;
            }
          }
        }
      }
      this.z_order.move(partSelectedZ, this.z_order.length-1);
    }
  }

  beginMouseDrag(e, puzzle) {
    /* Move all pieces in the select piece's part to the end of the z-order */
    if (this.state.lastSelectedPiece) {
      var part = this.state.lastSelectedPiece.parentPart;
      var partpieces_ids = part.pieces.map(function(piece) {return piece.id});
      this.z_order.movelistToEnd(partpieces_ids);
    }
    if(this.state.lastSelectedPiece.isSelected){
        this.state.isDragging = true;
        this.state.clickX = e.offsetX - this.state.lastSelectedPiece.currentPosition.x;
        this.state.clickY = e.offsetY - this.state.lastSelectedPiece.currentPosition.y;
    }
  }

  endMouseDrag(e, puzzle) {
    this.state.isDragging = false;
    if (this.state.lastSelectedPiece) {
      this.state.lastSelectedPiece.parentPart.attemptConnection();
    }
  }

}

class RectangleVideoPuzzle extends VideoPuzzle {

  constructor(rows = 5, cols=5,
              enableAudio=true,
              enableOpacityDtEffect=false,
              enableDisplayIdEffect=false,
              videoDelay=0,
              videoSrc=undefined,
              videoWidth,
              videoHeight) {
    super(enableAudio,
          videoDelay,
          videoSrc,
          videoWidth,
          videoHeight);
    this.pieceRows = rows;
    this.pieceCols = cols;
    this.enableOpacityDtEffect = enableOpacityDtEffect;
    this.enableDisplayIdEffect = enableDisplayIdEffect;
  }

  postVideoSetup(isReset=false) {

    //TODO: Maybe we should make the canvas bigger than than the puzzle?
    // This will give users some exra room to work with.
    this.canvasElement.width = this.videoElement.width;
    this.canvasElement.height = this.videoElement.height;

    var pieceHeight = this.videoElement.height/this.pieceRows;
    var pieceWidth = this.videoElement.width/this.pieceCols;
    /* Create the pieces at their initial positions */
    for(var row=0; row<this.pieceRows; row++){
        for(var col=0; col<this.pieceCols; col++){
            var currentX = Math.floor(Math.random()*this.videoElement.width);
            var currentY = Math.floor(Math.random()*this.videoElement.height);
            var id = row*this.pieceCols+col;
            var piece = new RectanglePuzzlePiece(this,
                                            id, col*pieceWidth, row*pieceHeight, currentX, currentY,
                                            pieceWidth, pieceHeight,
                                            this.marginForConnection,
                                            this.enableOpacityDtEffect,
                                            this.enableDisplayIdEffect);
            var part = new PuzzlePart(piece);
            this.pieces[id] = piece;
            this.parts[id] = part;
            this.z_order.push(id);
        }
    }

    /* Populate the neighbors for the created pieces */
    for (var id in this.pieces) {
      var piece = this.pieces[id];
      piece.neighborPieces = this.getNeighbors(piece);
      piece.unconnectedNeighbors = piece.neighborPieces;
    }

    // Start playing the background music for this puzzle
    if (this.audio.enable) {
      if (!this.audio.background.obj) {
        this.audio.background.obj = new Audio(this.audio.background.filename);
      }
      // If resetting, make sure we are starting at the beginning
      if (isReset) {
        this.audio.background.obj.currentTime = 0;
      }
      this.audio.background.obj.loop = true;
      this.audio.background.obj.play();
    }
    else {
      this.audio.background.obj.pause();
    }
    super.start();
  }

  start() {
    if (this.audio) {
      this.audio.background.obj = new Audio(this.audio.background.filename);
    }
    // If there is no video src defined, attempt to get it from the webcam
    var thisPuzzle = this;
    if (!this.videoSrc){
      navigator.getUserMedia =  navigator.getUserMedia ||
                                navigator.webkitGetUserMedia ||
                                navigator.mozGetUserMedia ||
                                navigator.msGetUserMedia;
      if(navigator.getUserMedia){
          navigator.getUserMedia({video: true},
            function(stream){
              thisPuzzle.videoElement.src = window.URL.createObjectURL(stream);
              thisPuzzle.videoElement.width = thisPuzzle.videoWidth;
              thisPuzzle.videoElement.height = thisPuzzle.videoHeight;
              thisPuzzle.videoStream = stream;
              thisPuzzle.videoElement.addEventListener("loadedmetadata", function(){thisPuzzle.postVideoSetup();}, false);
          }, this.onNoVideoAvail);
      }
    }
    else {
      thisPuzzle.videoElement.addEventListener("loadedmetadata", function(){thisPuzzle.postVideoSetup();}, false);
    }
  }

  restart(rows = 5, cols=5,
          enableAudio=true,
          enableOpacityDtEffect=false,
          enableDisplayIdEffect=false,
          videoDelay=0,
          videoSrc=undefined,
          videoWidth,
          videoHeight) {

      //TODO: this.audio = enableAudio;
      // Set the time limit to equal the audio time
      var d = new Date();
      this.startTime = d.getTime();
      this.timeLimit = (this.audio.background.obj.duration*1000) + this.videoDelay;
      this.pieceRows = rows;
      this.pieceCols = cols;
      this.enableOpacityDtEffect = enableOpacityDtEffect;
      this.enableDisplayIdEffect = enableDisplayIdEffect;
      this.state =  {
        isCompleted: false,
        isDragging: false,
        lastSelectedPiece: undefined,
        clickX: 0,
        clickY: 0
      };
      this.parts = {};
      this.pieces = {};
      this.z_order = [];
      this.audio.enable = enableAudio;
      this.postVideoSetup(true);
  }

  /* This function is called if we cannot access the user's webcam */
  onNoVideoAvail(e){
      console.log('Sorry, the video was not available', e);
      alert('Sorry, the video was not available');
  }

  getNeighbors(piece) {
    var id = piece.id;
    /*
     * ID Scheme (3 x 3 Example puzzle)
     *
     * -------------
     * | 0 | 1 | 2 |
     * -------------
     * | 3 | 4 | 5 |
     * -------------
     * | 6 | 7 | 8 |
     * -------------
     *
     * Given an id i possible borders:
     * {i+1, i-1, i+numrows, i-numrows}
     */
     // Make sure id doesn't overflow to the next row
     var ret = [];
     if (id+1 < ((~~(id/this.pieceCols)) + 1)*this.pieceCols){
       ret.push(this.pieces[id+1]);
     }
     // Make sure id doesn't underflow to the previous row
     if (id-1 >= (~~(id/this.pieceCols))*this.pieceCols){
       ret.push(this.pieces[id-1]);
     }
     if (id+this.pieceCols < this.pieceRows*this.pieceCols){
       ret.push(this.pieces[id+this.pieceCols])
     }
     if (id-this.pieceCols >= 0){
       ret.push(this.pieces[id-this.pieceCols]);
     }
     return ret;
  }

  getAdjacencyByDirection(piece, direction){
    var id = piece.id;
    switch(direction){
      case "up":
        id -= this.pieceRows;
        break;
      case "down":
        id += this.pieceCols;
        break;
      case "left":
        id -= 1;
        break;
      case "right":
        id += 1;
        break;
      default:
        return null;
    }

    if (id in this.pieces) {
      return this.pieces[id];
    }

    return null;
  }

}


class Rectangle {

  constructor(x, y, width, height){
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.left = x;
    this.right = x+width;
    this.up = y;
    this.down = y+height;
  }

  intersects(otherRect){
    return !(otherRect.left > this.right ||
            otherRect.right < this.left ||
            otherRect.top > this.bottom ||
            otherRect.bottom < this.top);
  }

}

class PuzzlePiece {
  constructor() {
    this.settings = {
      marginForConnection: 25,
    };

    this.id = 1;
    this.parentPuzzle = undefined;
    this.parentPart = undefined;
    this.isSelected = false;
    this.neighborPieces = [];
    this.unconnectedNeighbors = [];
    this.solutionX = 0;
    this.solutionY = 0;
    this.opacity = 1;
  }

  updateUnconnectedNeighbors() {
    var newUnconnectedNeighbors = [];
    var part = this.parentPart;
    this.unconnectedNeighbors.map(function(piece){
      if (part.pieces.lastIndexOf(piece) < 0) {
        newUnconnectedNeighbors.push(piece);
      }
    });
    this.unconnectedNeighbors = newUnconnectedNeighbors;
  }
}

class RectanglePuzzlePiece extends PuzzlePiece {

  constructor(parentPuzzle, id, solutionX, solutionY, currentX, currentY, width, height, marginForConnection, enableOpacityDtEffect, enableDisplayIdEffect) {
    super();
    this.id = id;
    this.solutionX = solutionX;
    this.solutionY = solutionY;
    this.parentPuzzle = parentPuzzle;
    this.currentPosition = new Rectangle(currentX, currentY, width, height);
    this.marginForConnection = marginForConnection;
    this.enableOpacityDtEffect = enableOpacityDtEffect;
    this.enableDisplayIdEffect = enableDisplayIdEffect;
  }

  updatePosition(loc){
    this.currentPosition.x = loc.x;
    this.currentPosition.y = loc.y;
  }

  updatePositionDelta(delta){
    this.currentPosition.x += delta.dx;
    this.currentPosition.y += delta.dy;
  }

  intersects(otherPiece) {
    return this.currentPosition.intersects(otherPiece.currentPosition);
  }

  getFirstConnection() {
    for (var i = 0; i < this.unconnectedNeighbors.length; i++) {
      var neighbor = this.unconnectedNeighbors[i];
      var ret = this.connectsWith(neighbor);
      if (ret.isConnecting){
        return {part: neighbor.parentPart, moveTo: ret.moveTo};
      }
    }
    return null;
  }

  isCovered(excludedPieces) {
    var z_order = this.parentPuzzle.z_order;
    var pieces = this.parentPuzzle.pieces;
    var start_idx = z_order.lastIndexOf(this.id);
    if (start_idx > 0) {
      // Check all pieces that have a higher z_order index for an interesction
      // If one exists, then this piece is covered by the other piece
      for (var i = start_idx+1; i < z_order.length; i++) {
        var id = z_order[i];
        var exclude = (-1 != excludedPieces.lastIndexOf(pieces[id]));
        if (!exclude && this.intersects(pieces[id])) {
          return true;
        }
      }
    }
    return false;
  }

  // See if this piece connects with another piece
  // If it does, return a connection object that contains information on how much
  // this piece needs to move to connect with the other piece
  connectsWith(piece) {

    // If the other pieces isn't a neighbor, don't permit a connection
    if (!piece || this.unconnectedNeighbors.lastIndexOf(piece) < 0) {
      return {isConnecting: false, moveTo:{}};
    }

    // Cannot connect with a piece that is covered!
    // TODO: For future consideration: do we permit connections if the
    // connecting edge is not covered, but part of the piece is??
    if(piece.isCovered([this])) {
      return {isConnnecting: false, moveTo:{}};
    }

    var solutionDx = piece.solutionX - this.solutionX;
    var solutionDy = piece.solutionY - this.solutionY;
    var currentDx = piece.currentPosition.x - this.currentPosition.x;
    var currentDy = piece.currentPosition.y - this.currentPosition.y;

    if (Math.abs(solutionDx - currentDx) < this.settings.marginForConnection
        && Math.abs(solutionDy - currentDy) < this.settings.marginForConnection) {
          var moveToPos = {x: (piece.currentPosition.x - solutionDx),
                           y: (piece.currentPosition.y - solutionDy)};
          var moveToDelta = {dx: (moveToPos.x - this.currentPosition.x),
                             dy: (moveToPos.y - this.currentPosition.y)};
          return {isConnecting: true,
                  moveTo: {pos: moveToPos,
                          delta: moveToDelta}
                  };
    }
    return {isConnnecting: false, moveTo:{}};
  }

  connect(piece, performPositionUpdate) {
    var res = this.connectsWith(piece);
    // Update this pieces posi
    if (res.isConnecting) {
      if (performPositionUpdate) {
        this.parentPart.updatePosition(res.moveTo);
      }
    }
  }

  preRenderSettings(ctx) {
    if (this.isSelected || this.parentPart.isSelected) {
      ctx.strokeStyle = "yellow";
      ctx.shadowColor = '#222';
      ctx.shadowBlur = 30;
      var downPiece = this.parentPuzzle.getAdjacencyByDirection(this, "down");
      var rightPiece = this.parentPuzzle.getAdjacencyByDirection(this, "right");
      if (!downPiece ||
          (this.unconnectedNeighbors.lastIndexOf(downPiece) >= 0)){
        ctx.shadowOffsetY = 10;
      }
      else {
        ctx.shadowOffsetY = 0;
      }
      if (!rightPiece ||
          (this.unconnectedNeighbors.lastIndexOf(rightPiece) >= 0)){
        ctx.shadowOffsetX = 10;
      }
      else {
        ctx.shadowOffsetX = 0;
      }
    }
    else {
      ctx.strokeStyle = "black";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    }
  }

  renderEffects(ctx) {
    if (this.enableOpacityDtEffect) {
      var d = new Date();
      this.opacity = (d.getTime() - this.parentPuzzle.startTime) / this.parentPuzzle.timeLimit;
      ctx.fillStyle = "rgba(0,0,0,"+this.opacity+")";
      ctx.fillRect(this.currentPosition.x,
                   this.currentPosition.y,
                   this.currentPosition.width,
                   this.currentPosition.height);
    }

    /* For debugging we provide the abilitiy to display the id in the piece */
    if (this.enableDisplayIdEffect) {
      ctx.font = "40px Arial";
      ctx.fillStyle = "white";
      ctx.strokeStyle = "black"
      ctx.fillText(this.id,
                  (this.currentPosition.x + this.currentPosition.width/2),
                  (this.currentPosition.y + this.currentPosition.height/2));
    }
  }

  render(ctx) {
    this.preRenderSettings(ctx);

    ctx.drawImage(this.parentPuzzle.videoElement,
                  this.solutionX,
                  this.solutionY,
                  this.currentPosition.width,
                  this.currentPosition.height,
                  this.currentPosition.x,
                  this.currentPosition.y,
                  this.currentPosition.width,
                  this.currentPosition.height);

    // Draw a border around the piece
    ctx.strokeRect(this.currentPosition.x, this.currentPosition.y, this.currentPosition.width, this.currentPosition.height);

    this.renderEffects(ctx);
  }
}


// A part is defined as a set of connected piece
class PuzzlePart {

  constructor(piece) {
    this.parentPuzzle = piece.parentPuzzle;
    this.id = piece.id;
    this.pieces = [piece];
    this.isSelected = false;
    piece.parentPart = this;
  }

  // Update the position of all pieces in this part
  updatePositionDelta(delta) {
    this.pieces.map(function(piece){
      piece.updatePositionDelta(delta);
    });
  }

  connect(connection) {
    // Move this parts pieces with the connection data
    this.updatePositionDelta(connection.moveTo.delta);

    // Inherit all pieces from the other part
    this.pieces = this.pieces.concat(connection.part.pieces);

    // Remove the other part from the parents list
    this.parentPuzzle.parts[connection.part.id] = null;
    /*
    var parts = this.parentPuzzle.parts;
    var remIdx = parts.lastIndexOf(connection.part);
    parts.splice(remIdx, 1);
    */

    // Remove the discarded part from the z_order
    var z_order = this.parentPuzzle.z_order;
    var remIdx = z_order.lastIndexOf(connection.part.id);
    z_order.splice(remIdx, 1);


    // Modify parent part and unconnected neighbors for all pieces in the new part
    var thisPart = this;
    this.pieces.map(function(piece){
      piece.parentPart = thisPart;
      piece.updateUnconnectedNeighbors();
    });
  }

  // Check if any piece that is in this part can make a connection
  // Only allow 1 movement
  attemptConnection() {
    var connectionMade = false;

    // Perform the single connection if it exists
    for (var i = 0; i<this.pieces.length; i++){
      var piece = this.pieces[i];
      var connection = piece.getFirstConnection();
      // Perfrom the connection if it exists
      if (connection != null) {
        console.log("Connection!");
        console.log(connection);
        this.connect(connection);
        return true;
      }
    }
  }

  render(ctx) {
    this.pieces.map(function(piece){piece.render(ctx)});
  }

}
