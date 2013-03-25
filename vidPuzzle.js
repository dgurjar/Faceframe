var canvas, ctx, stage;
var headcanvas, headctx;


/* TODO: place these into a game variable */
var pieceHeight, pieceWidth;
var pieceRows, pieceCols;

var pieces = [];
var parts = [];

var isDragging = false;
var clickOffsetX, clickOffsetY;

var htracker;


window.onload = function(){
    navigator.getUserMedia =    navigator.getUserMedia ||
                                navigator.webkitGetUserMedia ||
                                navigator.mozGetUserMedia ||
                                navigator.msGetUserMedia;

    video = document.querySelector('video');
    canvas = document.getElementById("c");
    ctx = canvas.getContext("2d");

    headcanvas =  document.getElementById("headtrack");
    headctx = headcanvas.getContext("2d");

    htracker = new headtrackr.Tracker({calcAngles : false, ui : false});

    localMediaStream = null;

    if(navigator.getUserMedia){
        navigator.getUserMedia({video: true}, function(stream){
            video.src = window.URL.createObjectURL(stream);
            localMediaStream = stream;
            /* Setup the game as soon as it is initialized */
            video.addEventListener("loadedmetadata", setup, false);
        }, onNoVideoAvail);
    }
}


/* Sets up the initial state of the game */
function setup(){
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    headcanvas.width = canvas.width;
    headcanvas.height = canvas.height;

    pieceRows = 5;
    pieceCols = 5;

    pieceHeight = video.videoHeight/pieceRows;
    pieceWidth = video.videoWidth/pieceCols;

    /* Create the pieces at their initial positions */
    for(var i=0; i<pieceRows; i++){
        for(var j=0; j<pieceCols; j++){
            var dest_x = Math.floor(Math.random()*video.videoWidth);
            var dest_y = Math.floor(Math.random()*video.videoHeight);
            pieces.push(new PuzzlePiece(i, j, dest_x, dest_y, 0));
        }
    }

    /* Initiates head tracking */
    trackHead();

    /* Update the video on the canvas on a regular interval */
    window.setInterval(update, 50);
    /* Manage mouse interactions with the puzzle */
    canvas.addEventListener("mousemove", updateSelect, false);
    canvas.addEventListener("mousedown", beginMouseDrag, false);
    canvas.addEventListener("mouseup", endMouseDrag, false);
}


/* Given a piece, draws it on the canvas */
function drawPiece(piece){
    var src_x = piece.src_col*pieceWidth;
    var src_y = piece.src_row*pieceHeight;
    ctx.drawImage(video, src_x, src_y, pieceWidth, pieceHeight, piece.dest_x, piece.dest_y, pieceWidth, pieceHeight);    

    ctx.fillStyle = "rgba(0,0,0,"+piece.opacity+")";
    ctx.fillRect(piece.dest_x, piece.dest_y, pieceWidth, pieceHeight);

    /* If the piece is selected, draw a border */
    if(piece.is_selected){
        ctx.strokeStyle = "yellow";
        ctx.strokeRect(piece.dest_x, piece.dest_y, pieceWidth, pieceHeight);
    }
    else{
        ctx.strokeStyle = "rgb(50,50,50)";
        ctx.strokeRect(piece.dest_x, piece.dest_y, pieceWidth, pieceHeight);        
    }
}


function beginMouseDrag(e){
    /* Find selected piece if it exists */
    if(pieces[pieces.length-1].is_selected){
        isDragging = true;
        clickOffsetX = e.offsetX - pieces[pieces.length-1].dest_x;
        clickOffsetY = e.offsetY - pieces[pieces.length-1].dest_y;
    }
}

function endMouseDrag(e){
    isDragging = false;
}

function updateSelect(e){
    if(isDragging){
        pieces[pieces.length-1].dest_x = e.offsetX - clickOffsetX;
        pieces[pieces.length-1].dest_y = e.offsetY - clickOffsetY;
    }
        else{
        pieces.forEach(function(piece){
            piece.is_selected = false;
        });

        for(var i=pieces.length-1; i>=0; i--){
            var p = pieces[i];
            if((e.offsetX > p.dest_x)
                &&(e.offsetX < (p.dest_x+pieceWidth))
                &&(e.offsetY > p.dest_y)
                &&(e.offsetY < (p.dest_y+pieceHeight))){

                var selected = pieces.splice(i, 1)[0];
                selected.is_selected = true;
                pieces.push(selected);
                return;
            }
        }
    }
}

/* A puzzle part is a set of pieces that are connected */
function PuzzlePart(piece){
    this.pieces = [];
    this.pieces[0] = piece;
}

/* Merges this part with another, removing the other instance in the process */
PuzzlePart.prototype.mergeParts = function(part_index){
    var part = parts[part_index];
    /* Move all pieces from one part to the next */
    for(var i=0; i<part.pieces; i++){
        this.pieces.push(parts[part_index].pieces[i]);
    }
    /* Delete the part */
    parts.splice(part_index, 1);
}

PuzzlePart.prototype.draw = function(){
    /* Draw all of the pieces in the part */

    /* If any one piece is selected, highlight the entire part */
}

/* Creates a new puzzle piece */
function PuzzlePiece(src_row, src_col, dest_x, dest_y, dest_z){
    this.src_row = src_row;
    this.src_col = src_col;
    this.dest_x = dest_x;
    this.dest_y = dest_y;
    this.dest_z = dest_z;
    this.is_selected = false;
    this.opacity = .9;
}

/* Function to draw this piece */
PuzzlePiece.prototype.draw = function(){
    var src_x = this.src_col*pieceWidth;
    var src_y = this.src_row*pieceHeight;
    ctx.drawImage(video, src_x, src_y, pieceWidth, pieceHeight, this.dest_x, this.dest_y, pieceWidth, pieceHeight);

    /* If the piece is selected, draw a border */
    if(this.is_selected){
        ctx.strokeStyle = "yellow";
        ctx.strokeRect(this.dest_x, this.dest_y, pieceWidth, pieceHeight);
    }
    else{
        ctx.strokeStyle = "black";
        ctx.strokeRect(this.dest_x, this.dest_y, pieceWidth, pieceHeight);        
    }
}


function drawBoard(){
    /* Set the background to black */
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    /* Draw the partitions for the pieces */
    ctx.strokeStyle = "white";
    for(var i=0; i<pieceRows; i++){
        ctx.beginPath();
        ctx.moveTo(0, i*pieceHeight);
        ctx.lineTo(canvas.width, i*pieceHeight);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(i*pieceWidth, 0);
        ctx.lineTo(i*pieceWidth, canvas.height);
        ctx.stroke();
    }
}

function trackHead(){
    htracker.init(video, headcanvas);
    htracker.start();

    document.addEventListener("facetrackingEvent", function( event ) {
        /* Redraw the pieces containted within the head */
        var width = event.width;
        var height = event.height;
        var x = event.x - width/2;
        var y = event.y - height/2;

        headctx.fillStyle = "rgba(0,0,50,.8)";
        headctx.fillRect(0,0,headcanvas.width, headcanvas.height);
        headctx.strokeStyle = "red";
        headctx.strokeRect(x, y, width, height);

        var headpieceindexes = getPiecesWithin(x, y, width, height);

        for(var i=0; i<pieces.length; i++)
            pieces[i].opacity = .9;
        headpieceindexes.forEach(function(index){
            pieces[index].opacity = .2;
        });
    });
}

/* Given an area representing a field of view, find all of the pieces within that area */
function getPiecesWithin(x, y, width, height){
    var ret = [];

    var faceRect = {"left": x,
                    "right": x+width,
                    "top": y,
                    "bottom": y+height};

    for(var i=0; i<pieces.length; i++){
        var p = pieces[i];
        var p_x = p.src_col*pieceWidth;
        var p_y = p.src_row*pieceHeight;
        var pieceRect = {"left": p_x,
                "right": p_x+pieceWidth,
                "top": p_y,
                "bottom": p_y+pieceHeight};
        if(intersectRect(faceRect, pieceRect)){
            ret.push(i);
        }
    }

    return ret;
}

function intersectRect(r1, r2) {
  return !(r2.left >= r1.right || 
           r2.right <= r1.left || 
           r2.top >= r1.bottom ||
           r2.bottom <= r1.top);
}

/* Takes a snapshot from the video feed, and then updates the canvas */
function update(){
    if(localMediaStream){
        /* Clear the canvas */
        ctx.clearRect(0,0,canvas.width,canvas.height);

        /* Draw the board */
        drawBoard();

        //TODO: use the draw property of the piece instead
        /* Render all of the puzzle pieces */
        pieces.forEach(drawPiece);

    }
}

/* This function is called if we cannot access the user's webcam */
function onNoVideoAvail(e){
    console.log('Sorry, the video was not available', e);
}