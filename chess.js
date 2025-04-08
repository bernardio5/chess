// the 2600 had a chess cartridge in 1978; 
// you will be able to get this running in JavaScript


// draw on a canvas, using a sprite sheet, "tiles.png".
// support transparency. draw on a grid. painter's alg

function spriteCanvas(aCanvas, x0, y0) {
    this.canvas = aCanvas; 
    this.context = aCanvas.getContext("2d");
    this.context.fillStyle = 'white';
    this.context.strokeStyle = "#000";
    this.tileSize = 48;    // size of tiles on screen; set how you please
    this.imgTileSz = 64;    // sze of tiles in exTiles: 32
    this.x0 = x0 * this.tileSize;
    this.y0 = y0 * this.tileSize;
    this.loaded = 0; 
    this.tiles = new Image(); 
    this.tiles.src = "tiles.png"; 
    that = this;
    this.tiles.onload= function(that) { that.loaded=1; }
    this.minX = 999.0; 
    this.minY = 999.0; 
    this.maxX = -999.0; 
    this.maxY = -999.0; 
}
spriteCanvas.prototype = {
    drawSprite: function(x, y, tx, ty) { 
        var ts = this.tileSize; 
        var is = this.imgTileSz;
        var xpos = this.x0 + (ts*x); 
        var ypos = this.y0 + (ts*y); 
        this.context.drawImage(this.tiles, tx*is, ty*is, is, is, xpos, ypos, ts, ts); 
        if (x<this.minX) { this.minX = x; }
        if (y<this.minY) { this.minY = y; }
        if (x>this.maxX) { this.maxX = x; }
        if (y>this.maxY) { this.maxY = y; }
    },
    drawLargeSprite: function(x, y, tx, ty, txsz, tysz) { 
        var ts = this.tileSize; 
        var is = this.imgTileSz;
        var xpos = this.x0 + (ts*x); 
        var ypos = this.y0 + (ts*y); 
        this.context.drawImage(this.tiles, tx*is, ty*is, txsz*is, tysz*is, xpos, ypos, txsz*ts, tysz*ts); 
        if (x<this.minX) { this.minX = x; }
        if (y<this.minY) { this.minY = y; }
        if ((x+txsz)>this.maxX) { this.maxX = (x+txsz); }
        if ((y+tysz)>this.maxY) { this.maxY = (y+tysz); }
    } 
}







//  a gamerules object to hold all the chess rules
// what's in a game state array, allowed moves generation, 
// scoring, return score for a position,

// positions don't get to be objects; I need too many of them, and they're 
// too simple:
// 64 ints representing the squares of the board, with -1 for empties.
// 2 ints: whether w/b's qr, k and kr have moved: castling
// 16 more ints: the spaces bearing pawns that can en-passant
// 2 ints for scoring, one of which is in use now.
// 2 ints: the source and dest squares for the move that made this position
// anything else? 64+6+16= 86

// mapping board pos to array position
// 0  1  2  3  4  5  6  7
// 8  9 10 11 12 13 14 15
//16 17 etc

// marker numbers as in tile set: 
// 0 WK  1 WQ  2 WR  3 WKn  4 WB  5 WP 
// 6 BK  7 BQ  8 BR  9 BKn 10 BB 11 BP


function gameRules() { 
    this.pieceVals = [999,9,5,3,3,1,-999,-9,-5,-3,-3,-1];
    this.castlyVals = [50,25,25,0];
    this.descorers = [ // !=-1=> good to move
        -1, 9,10,-1, -1,10,9,-1,
        -1,11,-1,11, 11,-1,11,-1,
        -1,-1,-1,-1, -1,-1,-1,-1,
        -1,-1,-1,-1, -1,-1,-1,-1,
        -1,-1,-1,-1, -1,-1,-1,-1,
        -1,-1,-1,-1, -1,-1,-1,-1,
        -1, 5,-1, 5,  5,-1, 5,-1,
        -1, 3, 4,-1, -1, 4, 3,-1];
    this.projection = [ // bigger=>better to control
        3, 3, 4, 5, 5, 4, 3, 3, 
        3, 3, 4, 5, 5, 4, 3, 3, 
        4, 4, 5, 6, 6, 5, 4, 4, 
        5, 5, 6, 7, 7, 6, 5, 5, 
        5, 5, 6, 7, 7, 6, 5, 5, 
        4, 4, 5, 6, 6, 5, 4, 4, 
        3, 3, 4, 5, 5, 4, 3, 3, 
        3, 3, 4, 5, 5, 4, 3, 3]; 
}

gameRules.prototype = {
    // this is both the initial game state and the template for game states
    initialPosition: function() { 
        res = [ 8, 9,10, 7,  6,10, 9, 8,  // 0     first 64 entries is board piece positions.
               11,11,11,11, 11,11,11,11,  // 8     if a marker is not on the board, we don't 
               -1,-1,-1,-1, -1,-1,-1,-1,  //16     have to think about it! 
               -1,-1,-1,-1, -1,-1,-1,-1,  //24
               -1,-1,-1,-1, -1,-1,-1,-1,
               -1,-1,-1,-1, -1,-1,-1,-1,
                5, 5, 5, 5,  5, 5, 5, 5,
                2, 3, 4, 1,  0, 4, 3, 2,  //56
        0,0, // w/b castle-disqualifying moves 0:ok 1:kr moved 2:qr moved 3:no  64 65
        8,9,10,11, 12,13,14,15,
        48,49,50,51, 52,53,54,55,// sqs of en-passant-capable pawns  66-81
        0,0, -1,-1, // score, move#, last-move-alteration  82, 83, 84, 85
        0, 0, // high and low scores below   86, 87
        0, 0 // self's index in parent's array of moves, score delta    88, 89
        ];
        return res;
    },
    
    // given position, compute score
    // white wants a higher score; black wants a lower score
    // if black is winning, the score is negative
    // do not analyze threats! that's tree work. 
    positionScore: function(pos) { 
        res = 0; 
        var i, ps, ds, val, descVal; 
        for (i=0; i<64; ++i) { // by the power of my for I fuck you
            ps = pos[i];
            if (ps!=-1) { 
                // the piece is worth its value * its place
                res += this.pieceVals[ps] * this.projection[i];
/*
                descVal = 0; // wtf is all this? Nee-yall
                ds = this.descorers[i];
                if (ds!=-1) {
                    if (ps==ds) {
                        descVal = -val;
                    }  
                }
                res += descVal;*/
            }
        }
        // being able to castle => defense not broken
        res += this.castlyVals[pos[64]];
        res -= this.castlyVals[pos[65]];
        return res;
    },

    //////////////////////////////////////////////////
    // helper functions for movesFromSquare
    hasWhiteMarker: function(pos, sq) { // is white on sq?
        var pc = pos[sq];
        return ((pc!=-1) && (pc<6)); 
    },
    hasBlackMarker: function(pos, sq) {
        return pos[sq]>5; 
    },

    // given pos, w/ kn at st, dx/dy give move direction, 
    // check whether it goes offboard or to a self-occupied square
    knightMove: function(pos, dx, dy, st, side) { 
        var col = st%8;
        if (col+dx<0) return -1; 
        if (col+dx>7) return -1; 
        var row = Math.floor((st-col)/8);  
        if (row+dy<0) return -1; 
        if (row+dy>7) return -1; 
        var newp = st + (dy*8) + dx; 
        if ((side==0) && (this.hasWhiteMarker(pos,newp))) return -1;
        if ((side==1) && (this.hasBlackMarker(pos,newp))) return -1;
        return newp;
    },

    // given pos, B or Q or R to move from place st, moving in direction dx/dy,
    // push possible moves in the direction onto "moves"
    slides: function(pos, dx, dy, st, side, moves) {
        var col = st%8;
        var row = Math.floor((st-col)/8);  
        var sq = st;
        var i=0;
        while (i<7) { 
            var newc = col + dx;
            if (newc<0) return moves; 
            if (newc>7) return moves; 
            var newr = row + dy; 
            if (newr<0) return moves; 
            if (row+dy>7) return moves; 
            var newsq = sq + (dy*8) + dx; 
            var hasWh = this.hasWhiteMarker(pos, newsq); 
            var hasBl = this.hasBlackMarker(pos, newsq); 
            if (side==0) {
                if (hasWh) { return moves; }
                if (hasBl) { moves.push(newsq); return moves; }
            } else {
                if (hasBl) { return moves; }
                if (hasWh) { moves.push(newsq); return moves; }                
            }
            moves.push(newsq);
            col = newc;
            row = newr;
            sq = newsq
            ++i;
        }
        return moves;
    },

    // Q: if I move the K there, can anyone take it? 
    oppoThreats: function(pos, side, sq) { 
        var hyp = [...pos];
        hyp[sq] = side*6; // WK=0; BK=6-- put the king there. 
        hyp[83] = pos[83]+1; // we moved the king; their move
        var res = []; 
        var i; 
        for (i=0; i<64; ++i) { 
            var ps = hyp[i];
            var isThr = false; 
            if ((side==0) && (ps>5)) { isThr = true; } 
            if ((side==1) && (ps>-1) && (ps<6)) { isThr = true; }
            if (isThr) { 
                var newMvs = this.movesFromSquare(hyp, i, 0); 
                res.push(...newMvs);
            }
        }
        return res;
    }, 

    canCastle(pos, side, dir) {
        var ksq = 60;
        var flags = pos[64];
        if (side==1) { ksq = 4; flags = pos[65]; }
        if (pos[ksq+dir]!=-1) return false; // guys in the way
        if (pos[ksq+dir+dir]!=-1) return false; 
        if (flags>3) return false; // K moved already
        if (dir==1) {
            if  (flags==2) return false; // KR moved
        } else {    
            if (flags==1) return false; // QR moved
        }  
        thr = this.oppoThreats(pos,side,ksq);
        if (thr.includes(ksq)) { return false; } // k in check
        thr = this.oppoThreats(pos,side,ksq+dir);
        if (thr.includes(ksq+dir)) { return false; } // k can't cross a threat
        thr = this.oppoThreats(pos,side,ksq+dir+dir);
        if (thr.includes(ksq+dir+dir)) { return false; } // would put k in check
        return true;
    },

    // ////////////////////////////////////////////////////////
    // given pos, and a sq#, return all moves, whatever the piece is
    // if you can't move it now, []
    // this fn is huge! 1/3 of the code. 
    movesFromSquare: function(pos, sq, fancyKing) { 
        var res = [];
        var pc = pos[sq];
        if (pc<0) return []; // empty space! beat it, fool.
        var turn = pos[83]%2;
        // black can't move white and white can't move black
        if (turn==0) { 
            if (pc>5) return [];
        } else {
            if (pc<6) return [];
        }
        var col = sq%8;
        var row = Math.floor((sq-col)/8);  
        // initial at-all
        var i, thr;
        switch (pc) {
            case 0: // WK
                if (fancyKing==1) { // only allow safe king moves
                    i = sq-9; 
                    if ((row>0) && (col>0) && (!this.hasWhiteMarker(pos,i))) { 
                        thr = this.oppoThreats(pos,0, i);
                        if (!thr.includes(i)) { res.push(i); }
                    }
                    i = sq-8; 
                    if ((row>0) && (!this.hasWhiteMarker(pos,i))) { 
                        thr = this.oppoThreats(pos,0, i);
                        if (!thr.includes(i)) { res.push(i); }
                    }
                    i = sq-7; 
                    if ((row>0) && (col<7) && (!this.hasWhiteMarker(pos,i))) { 
                        thr = this.oppoThreats(pos,0, i);
                        if (!thr.includes(i)) { res.push(i); }
                    }
                    i = sq-1; 
                    if ((col>0) && (!this.hasWhiteMarker(pos,i))) { 
                        thr = this.oppoThreats(pos,0, i);
                        if (!thr.includes(i)) { res.push(i); }
                    }
                    i = sq+1; 
                    if ((col<7) && (!this.hasWhiteMarker(pos,i))) { 
                        thr = this.oppoThreats(pos,0, i);
                        if (!thr.includes(i)) { res.push(i); }
                    }
                    i = sq+7; 
                    if ((row<7) && (col>0) && (!this.hasWhiteMarker(pos,i))) { 
                        thr = this.oppoThreats(pos,0, i);
                        if (!thr.includes(i)) { res.push(i); }
                    }
                    i = sq+8; 
                    if ((row<7) && (!this.hasWhiteMarker(pos,i))) { 
                        thr = this.oppoThreats(pos,0, i);
                        if (!thr.includes(i)) { res.push(i); }
                    }
                    i = sq+9; 
                    if ((row<7) && (col<7) && (!this.hasWhiteMarker(pos,i))) { 
                        thr = this.oppoThreats(pos,0, i);
                        if (!thr.includes(i)) { res.push(i); }
                    }
                    if (this.canCastle(pos,0,1)) { res.push(62); }
                    if (this.canCastle(pos,0,-1)) { res.push(58); }
                } else { 
                    i = sq-9; 
                    if ((row>0) && (col>0) && (!this.hasWhiteMarker(pos,i))) {res.push(i);}
                    i = sq-8; 
                    if ((row>0) && (!this.hasWhiteMarker(pos,i))) {res.push(i);}
                    i = sq-7; 
                    if ((row>0) && (col<7) && (!this.hasWhiteMarker(pos,i))) {res.push(i);}
                    i = sq-1; 
                    if ((col>0) && (!this.hasWhiteMarker(pos,i)) ) {res.push(i);}
                    i = sq+1; 
                    if ((col<7) && (!this.hasWhiteMarker(pos,i)) ) {res.push(i);}
                    i = sq+7; 
                    if ((row<7) && (col>0) && (!this.hasWhiteMarker(pos,i)) ) {res.push(i);}
                    i = sq+8; 
                    if ((row<7) && (!this.hasWhiteMarker(pos,i))) {res.push(i);}
                    i = sq+9; 
                    if ((row<7) && (col<7) && (!this.hasWhiteMarker(pos,i))) {res.push(i);}
                }
                break; 
            case 1: // WQ
                res = this.slides(pos,  0,-1,  sq,0, res);
                res = this.slides(pos, -1,-1,  sq,0, res);
                res = this.slides(pos, -1, 0,  sq,0, res);
                res = this.slides(pos, -1, 1,  sq,0, res);
                res = this.slides(pos,  0, 1,  sq,0, res);
                res = this.slides(pos,  1, 1,  sq,0, res);
                res = this.slides(pos,  1, 0,  sq,0, res);
                res = this.slides(pos,  1,-1,  sq,0, res);
                break; 
            case 2: // WR
                res = this.slides(pos,  0,-1,  sq,0, res);
                res = this.slides(pos, -1, 0,  sq,0, res);
                res = this.slides(pos,  1, 0,  sq,0, res);
                res = this.slides(pos,  0, 1,  sq,0, res);
                break;
            case 3: // WKn
                i = this.knightMove(pos, -1,-2,sq,0);
                if (i!=-1) res.push(i);
                i = this.knightMove(pos, 1,-2,sq,0);
                if (i!=-1) res.push(i);
                i = this.knightMove(pos, -2,-1,sq,0);
                if (i!=-1) res.push(i);
                i = this.knightMove(pos, 2,-1,sq,0);
                if (i!=-1) res.push(i);
                i = this.knightMove(pos, -2,1,sq,0);
                if (i!=-1) res.push(i);
                i = this.knightMove(pos, 2,1,sq,0);
                if (i!=-1) res.push(i);
                i = this.knightMove(pos, -1,2,sq,0);
                if (i!=-1) res.push(i);
                i = this.knightMove(pos, 1,2,sq,0);
                if (i!=-1) res.push(i);
                break; 
            case 4: // WB
                res = this.slides(pos, -1,-1,  sq,0, res);
                res = this.slides(pos, -1, 1,  sq,0, res);
                res = this.slides(pos,  1, 1,  sq,0, res);
                res = this.slides(pos,  1,-1,  sq,0, res);
                break; 
            case 5: // WP
                if (row==6) {
                    i = sq-16; 
                    if ((!this.hasWhiteMarker(pos,i))&&(!this.hasBlackMarker(pos,i)) && 
                        (!this.hasWhiteMarker(pos,i+8))&&(!this.hasBlackMarker(pos,i+8))
                        ) {
                        res.push(i);
                    }
                } 
                i = sq-9; 
                if ((row>0) && (col>0) && (this.hasBlackMarker(pos,i))) {res.push(i);}
                i = sq-8; 
                if ((row>0) && (!this.hasWhiteMarker(pos,i))&&(!this.hasBlackMarker(pos,i))) {res.push(i);}
                i = sq-7; 
                if ((row>0) && (col<7) && (this.hasBlackMarker(pos,i))) {res.push(i);}
                break; 
            case 6: // BK
                if (fancyKing==1) {
                    i = sq-9; 
                    if ((row>0) && (col>0) && (!this.hasBlackMarker(pos,i))) { 
                        thr = this.oppoThreats(pos,1, i);
                        if (!thr.includes(i)) { res.push(i); }
                    }
                    i = sq-8; 
                    if ((row>0) && (!this.hasBlackMarker(pos,i))) { 
                        thr = this.oppoThreats(pos,1, i);
                        if (!thr.includes(i)) { res.push(i); }
                    }
                    i = sq-7; 
                    if ((row>0) && (col<7) && (!this.hasBlackMarker(pos,i))) { 
                        thr = this.oppoThreats(pos,1, i);
                        if (!thr.includes(i)) { res.push(i); }
                    }
                    i = sq-1; 
                    if ((col>0) && (!this.hasBlackMarker(pos,i))) { 
                        thr = this.oppoThreats(pos,1, i);
                        if (!thr.includes(i)) { res.push(i); }
                    }
                    i = sq+1; 
                    if ((col<7) && (!this.hasBlackMarker(pos,i))) { 
                        thr = this.oppoThreats(pos,1, i);
                        if (!thr.includes(i)) { res.push(i); }
                    }
                    i = sq+7; 
                    if ((row<7) && (col>0) && (!this.hasBlackMarker(pos,i)) ) { 
                        thr = this.oppoThreats(pos,1, i);
                        if (!thr.includes(i)) { res.push(i); }
                    }
                    i = sq+8; 
                    if ((row<7) && (!this.hasBlackMarker(pos,i))) { 
                        thr = this.oppoThreats(pos,1, i);
                        if (!thr.includes(i)) { res.push(i); }
                    }
                    i = sq+9; 
                    if ((row<7) && (col<7) && (!this.hasBlackMarker(pos,i))) { 
                        thr = this.oppoThreats(pos,1, i);
                        if (!thr.includes(i)) { res.push(i); }
                    }
                    if (this.canCastle(pos,1,1)) { res.push(6); }
                    if (this.canCastle(pos,1,-1)) { res.push(2); }
                } else {
                    i = sq-9; 
                    if ((row>0) && (col>0) && (!this.hasBlackMarker(pos,i))) {res.push(i);}
                    i = sq-8; 
                    if ((row>0) && (!this.hasBlackMarker(pos,i))) {res.push(i);}
                    i = sq-7; 
                    if ((row>0) && (col<7) && (!this.hasBlackMarker(pos,i))) {res.push(i);}
                    i = sq-1; 
                    if ((col>0) && (!this.hasBlackMarker(pos,i))) {res.push(i);}
                    i = sq+1; 
                    if ((col<7) && (!this.hasBlackMarker(pos,i))) {res.push(i);}
                    i = sq+7; 
                    if ((row<7) && (col>0) && (!this.hasBlackMarker(pos,i))) {res.push(i);}
                    i = sq+8; 
                    if ((row<7) && (!this.hasBlackMarker(pos,i))) {res.push(i);}
                    i = sq+9; 
                    if ((row<7) && (col<7) && (!this.hasBlackMarker(pos,i))) {res.push(i);}
                }
                break; 
            case 7: // BQ
                res = this.slides(pos,  0,-1,  sq,1, res);
                res = this.slides(pos, -1,-1,  sq,1, res);
                res = this.slides(pos, -1, 0,  sq,1, res);
                res = this.slides(pos, -1, 1,  sq,1, res);
                res = this.slides(pos,  0, 1,  sq,1, res);
                res = this.slides(pos,  1, 1,  sq,1, res);
                res = this.slides(pos,  1, 0,  sq,1, res);
                res = this.slides(pos,  1,-1,  sq,1, res);
                break; 
            case 8: // BR
                res = this.slides(pos,  0,-1,  sq,1, res);
                res = this.slides(pos, -1, 0,  sq,1, res);
                res = this.slides(pos,  1, 0,  sq,1, res);
                res = this.slides(pos,  0, 1,  sq,1, res);
                break; 
            case 9: // BKn
                i = this.knightMove(pos, -1,-2,sq,1);
                if (i!=-1) res.push(i);
                i = this.knightMove(pos, 1,-2,sq,1);
                if (i!=-1) res.push(i);
                i = this.knightMove(pos, -2,-1,sq,1);
                if (i!=-1) res.push(i);
                i = this.knightMove(pos, 2,-1,sq,1);
                if (i!=-1) res.push(i);
                i = this.knightMove(pos, -2,1,sq,1);
                if (i!=-1) res.push(i);
                i = this.knightMove(pos, 2,1,sq,1);
                if (i!=-1) res.push(i);
                i = this.knightMove(pos, -1,2,sq,1);
                if (i!=-1) res.push(i);
                i = this.knightMove(pos, 1,2,sq,1);
                if (i!=-1) res.push(i);
                break; 
            case 10: // BB
                res = this.slides(pos, -1,-1,  sq,1, res);
                res = this.slides(pos, -1, 1,  sq,1, res);
                res = this.slides(pos,  1, 1,  sq,1, res);
                res = this.slides(pos,  1,-1,  sq,1, res);
                break; 
            case 11: // BP
                if (row==1) {
                    i = sq+16; 
                    if ((!this.hasWhiteMarker(pos,i))&&(!this.hasBlackMarker(pos,i)) &&
                        (!this.hasWhiteMarker(pos,i-8))&&(!this.hasBlackMarker(pos,i-8))) {res.push(i);}
                } 
                i = sq+7; 
                if ((col>0) && (row<7) && (this.hasWhiteMarker(pos,i))) {res.push(i);}
                i = sq+8; 
                if ((row<7) && (!this.hasWhiteMarker(pos,i))&&(!this.hasBlackMarker(pos,i))) {res.push(i);}
                i = sq+9; 
                if ((col<7) && (row<7) && (this.hasWhiteMarker(pos,i))) {res.push(i);}
                break; 
        }
        return res; 
    },

    //////////////////////////////////////////////////////////
    // position + from square# + to# => new position!
    applyMove: function(pos, from, to) { 
        var res = [...pos]; // copy!
        var movee = pos[from];
        var moved = 0;
        
        // promote pawns
        if (movee==5) { // WP
            if (to<8) { // top row
                res[from] = -1; 
                res[to] = 1; // promoted! just make it a q for now
                moved = 1;
            }
        } 
        if (movee==11) { // BP
            if (to>55) { // bottom row
                res[from]=-1;
                res[to] = 7; 
                moved = 1;
            }
        } 
        // moving kings: castling?  
        if ((movee==0) && (res[64]<3)) { // WK
            // oo check that tween pieces are not there! 
            res[64] = 3; // can't castle (twice)
            if ((from==60) && (to==62) && ((res[64]==0)||(res[64]==2))) { // castling K-side
                res[60]=-1;
                res[61]=2;
                res[62]=0;
                res[63]=-1;
                res[68] = 1; 
                moved = 1;
            }
            if ((from==60) && (to==58) && ((res[64]==0)||(res[64]==1))) { // castling Q-side
                res[60]=-1;
                res[59]=2;
                res[58]=0;
                res[56]=-1;
                moved = 1;
            }
        }
        if ((movee==6) && (res[65]==0)) { // BK
            res[65] = 3;
            if ((from==4) && (to==6) && ((res[65]==0)||(res[65]==2))) { // castling K-side
                res[4]=-1;
                res[5]=8;
                res[6]=6;
                res[7]=-1;
                moved = 1;
            }
            if ((from==4) && (to==2) && ((res[65]==0)||(res[65]==2))) { // castling K-side
                res[4]=-1;
                res[3]=8;
                res[2]=6;
                res[0]=-1;
                moved = 1;
            }
        } 
        if (movee==2) { // WR; mark as moved for castling
            if (from==63) { res[64] += 1; } // KR?
            if (from==56) { res[64] += 2; }// QR 
        } 
        if (movee==6) { //BR
            if (from==0)  { res[65] += 1; }
            if (from==7)  { res[65] += 2; }
        }
        // everyone else: move the piece and empty out the from-space
        if (moved==0) {
            res[to] = res[from];
            res[from] = -1;
        }
        // enpassant disqualification TBD

        // compute new score
        res[82] = this.positionScore(res);
        res[83] = pos[83]+1; // move# 
        res[84] = from; 
        res[85] = to; 
        res[86] = 0; 
        res[87] = 0;
        res[88] = 0; 
        res[89] = res[82] - pos[82]; 
        return res;
    },



    // returns all available moves 
    allMoves: function(pos, side) { 
        var res = [];
        var i, j, len; 
        for (i=0; i<64; ++i) { 
            if (((side==0) && (this.hasWhiteMarker(pos,i))) ||
                ((side==1) && (this.hasBlackMarker(pos,i)))) { 
                var newMvs = this.movesFromSquare(pos, i, 1); 
                len = newMvs.length;
                for (j=0; j<len; ++j) { 
                    res.push([i,newMvs[j]]);
                }
            }
        }
        return res;
    }, 

}


// given a pos, how to get it to move?
// 1 make a treeNode, put pos in it.
// 2 generate all possible moves
// 3 for each move, make new pos by applying the move, add as child
// 4 for each new pos, recurse, till you're deep enough
// 5 depth-first, generate scores, find best score: that's your move
// 6 percolate up: highScore = best(bestscore) of children
// 7 at root node, select the bestscore's move



function treeNode(pos, rules) { 
/*      res = [ 8, 9,10, 7,  6,10, 9, 8,  // 0     first 64 entries is board piece positions.
               11,11,11,11, 11,11,11,11,  // 8     if a marker is not on the board, we don't 
               -1,-1,-1,-1, -1,-1,-1,-1,  //16     have to think about it! 
               -1,-1,-1,-1, -1,-1,-1,-1,  //24
               -1,-1,-1,-1, -1,-1,-1,-1,
               -1,-1,-1,-1, -1,-1,-1,-1,
                5, 5, 5, 5,  5, 5, 5, 5,
                2, 3, 4, 1,  0, 4, 3, 2,  //56
        0,0, // w/b castle-disqualifying moves 2^0=kingmoved 2^1=kr 2^2=qr  64 65
        8,9,10,11, 12,13,14,15,
        48,49,50,51, 52,53,54,55,// sqs of en-passant-capable pawns  66-81
        0,0, -1,-1,         // score, move#, last-move-alteration  82, 83, 84, 85
        0, 0,               // high and low scores below             86, 87
        0, 0                // index in parent's arrays, score del   88, 89
        */
    this.pos = pos; // the position represented by this node
    this.theRules = rules;
    this.children = []; // array of available-move resulting nodes -- it's a tree, yes?    
    this.parent = null;
}


treeNode.prototype = {
    // make a new move, with a score, but not children
    generate: function(pos, from, to, place) {
        newPos = this.theRules.applyMove(pos, from, to);
        newPos[88] = place; 
        return new treeNode(newPos, this.theRules);
    },

    addChild: function(child) {
        child.parent = this;
        this.children.push(child);
        var chScore = child.pos[82];
        ancestor = this; 
        while (ancestor.parent != null) { 
            // first child should set high and low 
            if (ancestor.children.length==1) {
                ancestor.pos[86] = chScore;
                ancestor.pos[87] = chScore;
            } else { // others have to win
                if (chScore>ancestor.pos[86]) { ancestor.pos[86] = chScore; }
                if (chScore<ancestor.pos[87]) { ancestor.pos[87] = chScore; }
            }
            ancestor = ancestor.parent;
        } // doesn't affect root, which is always white, scores there not examined.
    },

    // discover available moves (respecting whose turn it is!)
    // for all available moves, make a child
    fill: function() {
        var i, j, marker; 
        var pos = this.pos; 
        side = pos[83] %2; 
        if (side==0) { // white's turn
            for (i=0; i<64; ++i) {
                marker = pos[i];  
                if ((-1<marker) && (marker<6)) { // white marker
                    markMoves = this.theRules.movesFromSquare(pos, i, 1);
                    ml = markMoves.length; 
                    for (j=0; j<ml; ++j) { 
                        var newkid = this.generate(pos, i, markMoves[j], j);
                        this.addChild(newkid); 
                    }
                }
            }
        } else { // black's
            for (i=0; i<64; ++i) { 
                marker = pos[i];  
                if ((5<marker) && (marker<12)) { // black marker
                    markMoves = this.theRules.movesFromSquare(pos, i, 1);
                    ml = markMoves.length; 
                    for (j=0; j<ml; ++j) { 
                        var newkid = this.generate(pos, i, markMoves[j], j);
                        this.addChild(newkid); 
                    }
                }
            }
        }
    },

    // given a node, build all children and grandchildren
    // should be ~500 nodes, take much <1sec
    twoFill: function() {
        this.fill(); 
        var i, j, ln, chln, child, gchild; 
        ln = this.children.length; 
        for (i=0; i<ln; ++i) {
            child = this.children[i]; 
            child.fill(); 

            chln = child.children.length;
            for (j=0; j<chln; ++j) {
                gchild = child.children[j];
                gchild.fill(); 
            }
        }
    },


    // delete all the nodes that get not-chosen
    winnow: function(chosenFrom, chosenTo) {
        var i, nm;
        nm = this.children.length;  
        for (i=0; i<nm; ++i) {
            ch = this.children[i];
            if ((ch.genFrom()!=chosenFrom) || (ch.genTo()!=chosenTo)) {
                
            }
        }
    },

    // recursively self and all below
    prune: function() {
        var i, nm;
        nm = this.children.length;  
        for (i=0; i<nm; ++i) {
            this.children.splice(i, 1);  
        }
        delete this; 
    },


    genFrom: function() { return this.pos[84]; },
    genTo: function() { return this.pos[85]; },
    bestScore: function() { 
        var turn = this.pos[83] % 2; 
        if (turn==0) { return this.pos[86]; }
        if (turn==0) { return this.pos[87]; }
    },
    indAsChild: function() { return this.pos[88]; }
}



// the decisionTree holds and manipulates itself. 
// decisionTree provides a doMove function, which moves root down the tree. 

// workUnit: runs for <.1sec, does useful work that can be resumed

// each position offers ~30 moves. to know to protect a piece, 
// you need to look ahead 5 moves. 30^5 is 24,300,000: prioritize!

// opts: 

// 1) when white moves, it could be anything: crazy garbage. 
// don't fill out white's decision tree; it's 30x larger than black's
// 2) sort potential moves by score delta

// to do: add a "black's move" mode; give it a visual cue
//   for black's move, root is white's last. The 


function decisionTree(rules) {
    this.rules = rules;
    var firstPos = this.rules.initialPosition(); 
    this.root = new treeNode(firstPos, rules);
    this.root.twoFill(); 
    // computation resumption
    this.currentGChild = this.root.children[0].children[0];
    this.gchildrenDone = 0; 
}

decisionTree.prototype = {
    currentPosition: function() {
        return this.root.pos;
    },
    
    // they moved; we were waiting with a response. 
    // replace root with the node we moved to. 
    applyMove: function(from, to) {
        // delete the moves not taken
        // this.root.winnow(from, to); 
        // find white's move
        var i, score, best, ch, chosen, ln;
        ln = this.root.children.length; 
        newRt = this.root.children[0];
        for (i=0; i<ln; ++i) {
            ch = this.root.children[i];
            if ((ch.genFrom()==from) && (ch.genTo()==to)) {
                console.log("whitemove: "+i+":"+ch.pos);
                newRt = ch;
            }
        }
        newRt.twoFill(); 
        
        // pick black's response
        ln = newRt.children.length; 
        best = newRt.children[0].bestScore(); 
        chosen = newRt.children[0];
        for (i=0; i<ln; ++i) { 
            if (newRt.children[i].bestScore()<best) {
                console.log("blackmove: "+i+":"+newRt.children[i].pos);
                chosen = newRt.children[i];
                best = chosen.bestScore();
            }
        }
        blFrom = chosen.genFrom(); 
        blTo = chosen.genTo();
        this.root = chosen;
        this.currentGChild = this.root.children[0].children[0];
    }, 

    // game's doTick calls this: twoFill one rootnode's grandchild
    workUnit: function() {
        if (this.currentGChild==null) return;
        var gc = this.currentGChild;
        var ch = gc.parent; 
        var gcip = gc.indAsChild() +1;
        
        if (this.gchildrenDone!=0) return;
        if (gcip < ch.children.length) {
            gc = ch.children[gcip];
        } else {
            // goto next child
            var chip = ch.indAsChild() +1; 
            if (chip<ch.parent.children.length) {
                ch = ch.parent.children[chip];
                gc = ch.children[0]; 
            } else {
                this.gchildrenDone = 1; 
                console.log("gchildrenDone");
                return;
            }
        }      
        gc.twoFill();
        this.currentGChild = gc; 
    },

    getCompMoveFrom: function() {
        return this.root.genFrom();
    },
    getCompMoveTo: function() {
        return this.root.genTo();
    }
}



// duties: use theRules.initialPosition to set initial position
// use theRules.X to generate all available next moves.
// use theRules.positionScore to evaluate moves. 


// when player is moving, make a list of available moves for selected pieces;
// inteface only allows legal moves. 
// when computer is moving, do thr
// try to have as little chess-specific stuff as possible


function game(rules) {
    this.theRules = rules;
    this.theTree = new decisionTree(rules);
    // available moves
    this.moves = []; // available for currently-selected piece
    this.history = [ ]; // game history
    this.moveCt = 0; 

    this.compMoveStart = -1; 
    this.compMoveEnd = -1;
    this.winner = 0; // 1:w 2:b
}

game.prototype = {
    // return the pos of the root node, the current board state
    getCurrent: function() { 
        return this.theTree.currentPosition(); 
    },

    // return the list of spaces the piece at 'from' can move to
    getMoves: function(from) {
        var pos = this.theTree.currentPosition(); 
        this.moves = this.theRules.movesFromSquare(pos, from, true);
        return this.moves;
    },

    doTick: function() { 
        this.theTree.workUnit();
    },

    // given moving a piece from # to #, change the board
    doMove: function(from, to) {
        var next = this.theTree.applyMove(from, to);
        this.compMoveStart = this.theTree.getCompMoveFrom();
        this.compMoveEnd = this.theTree.getCompMoveTo();
    },
}



// the board: init, draws the board, takes input, tick fn that does tree stuff. 
// to do: move more chess-specific stuff out? abt size, board size?

// modes during play: waiting for first click, which selects a piece to move
// waiting for second click (or a reselection click)
// displaying the piece that the computer will move
// displaying the move selected. 

function board(canv) {
    this.sp = new spriteCanvas(canv, 0,0); 
    this.theRules = new gameRules(); 
    this.theGame = new game(this.theRules);
    this.selected = -1; // the square of the player's selected marker
    this.moves = []; // the squares to which the selected marker may move
    // apologies for the magic-number state machine shit-- it's brief.
    this.playMode = 0; // 0 waiting 1 player has selected 2 comp move 3 white won 4 black 
    this.modeTimer = 0; // comp plays instantly; give the player time to see it. 
    this.compMoveFrom = -1; 
    this.compMoveTo = -1; 
}

board.prototype = {
    drawOnSquare: function(which, tileX) {
        if (which<0) return;
        if (which>63) return;
        var px = which%8;
        var py = Math.floor((which-px)/8);    
        var tx = (px*1.038) + 0.39; 
        var ty = (py*1.03) + 0.41;
        this.sp.drawSprite(tx, ty, tileX,10);
    },

    touchEnd: function(evt) { 
        if ((evt.offsetX>24)&& (this.playMode<2)) { 
            var sx = Math.floor((evt.offsetX-24)/ 48.0);
            var sy = Math.floor((evt.offsetY-24)/ 48.0);
            var tile = (sy*8)+sx; 
            var len = this.moves.length; 
            var didMove = false;
            // if they clicked on one of the "moves" squares, 
            // complete thier move and switch to comp-turn mode
            for (i=0; i<len; ++i) { 
                if (this.moves[i]==tile) {
                    console.log("move is:" + this.selected + "," + tile);
                    this.theGame.doMove(this.selected, tile);
                    this.selected = -1;
                    if (this.theGame.winner>0) { this.playMode = this.theGame.winner +2; }
                    else {
                        this.playMode = 2; // begin computer-move mode
                        this.modeTimer = 20; // 2s timer to show move
                    }
                }
            }
            // they clicked on something else
            if (didMove==false) {
                var current = this.theGame.getCurrent(); 
                var content = current[tile];
                if ((-1<content)&&(content<6)) { // clicked on a white piece
                    this.selected = tile;
                    console.log("sel:" + tile); 
                    this.moves = this.theGame.getMoves(tile);
                    console.log("moves:" + this.moves);
                    this.playMode = 1; 
                } else {
                    this.moves = [];
                }
            }
        }
    },

    
    redraw() { // called 10 times/sec
        var currentP = this.theGame.getCurrent(); 
        var i; 

        // this.theGame.doTick(); 
        if (this.modeTimer>0) {
            --this.modeTimer; 
            if (this.modeTimer < 1) {
                if (this.playMode == 2) { 
                    this.playMode = 0; 
                }
            }
        }

        // draw board (erases last board :)
        this.sp.drawLargeSprite(0.0,0.0, 0,0, 9,9);
        
        switch (this.playMode) {
        case 0: // waiting for piece selection
            for (i=0; i<64; ++i) { // draw all pieces
                if (currentP[i]>-1) {
                    this.drawOnSquare(i, currentP[i]);
                }
            }
            break;
        case 1: // piece selected
            // draw selection indicator
            this.drawOnSquare(this.selected,14);
            for (i=0; i<64; ++i) { // draw all pieces
                if (currentP[i]>-1) {
                    this.drawOnSquare(i, currentP[i]);
                }
            }
            var len = this.moves.length; 
            for (i=0; i<len; ++i) { // draw moves available to this piece
                this.drawOnSquare(this.moves[i], 12);
            }
            break;
        case 2: // showing computer's move
        case 3: // white won
        case 4: // black won
            // draw selection indicators
            this.drawOnSquare(this.theGame.compMoveStart,14);
            this.drawOnSquare(this.theGame.compMoveEnd,14);
            for (i=0; i<64; ++i) { // draw all pieces
                if (currentP[i]>-1) {
                    this.drawOnSquare(i, currentP[i]);
                }
            }
            break; 
        }
    }
}



