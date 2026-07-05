const socket = io();
const chess = new Chess();

const boardElement = document.querySelector(".chessboard");
const statusElement = document.querySelector("[data-status]");
const roleElement = document.querySelector("[data-role]");
const turnElement = document.querySelector("[data-turn]");
const capturedWhiteElement = document.querySelector("[data-captured-white]");
const capturedBlackElement = document.querySelector("[data-captured-black]");
const promotionDialog = document.querySelector("[data-promotion-dialog]");
const promotionChoices = document.querySelector("[data-promotion-choices]");

let draggedPiece = null;
let sourceSquare = null;
let selectedSquare = null;
let pendingPromotionMove = null;
let playerRole = null;
let lastMove = null;

const pieceSymbols = {
    wp: "♙",
    wn: "♘",
    wb: "♗",
    wr: "♖",
    wq: "♕",
    wk: "♔",
    bp: "♟",
    bn: "♞",
    bb: "♝",
    br: "♜",
    bq: "♛",
    bk: "♚"
};

const pieceValues = {
    p: 1,
    n: 3,
    b: 3,
    r: 5,
    q: 9,
    k: 0
};

const files = "abcdefgh";

const getPieceUnicode = (piece) => pieceSymbols[`${piece.color}${piece.type}`] || "";

const squareName = ({ row, col }) => `${files[col]}${8 - row}`;

const getTurn = () => chess.turn();

const isGameOver = () => {
    if (typeof chess.game_over === "function") return chess.game_over();
    if (typeof chess.isGameOver === "function") return chess.isGameOver();
    return false;
};

const isCheck = () => {
    if (typeof chess.in_check === "function") return chess.in_check();
    if (typeof chess.inCheck === "function") return chess.inCheck();
    return false;
};

const isCheckmate = () => {
    if (typeof chess.in_checkmate === "function") return chess.in_checkmate();
    if (typeof chess.isCheckmate === "function") return chess.isCheckmate();
    return false;
};

const isDraw = () => {
    if (typeof chess.in_draw === "function") return chess.in_draw();
    if (typeof chess.isDraw === "function") return chess.isDraw();
    return false;
};

const canMovePiece = (piece) => (
    piece &&
    playerRole === piece.color &&
    getTurn() === playerRole &&
    !isGameOver()
);

const legalMovesFrom = (square) => chess.moves({ square, verbose: true });

const getStatusText = () => {
    const side = getTurn() === "w" ? "White" : "Black";

    if (isCheckmate()) {
        return `Checkmate. ${side === "White" ? "Black" : "White"} wins.`;
    }

    if (isDraw()) {
        return "Draw.";
    }

    if (isCheck()) {
        return `${side} to move. Check.`;
    }

    return `${side} to move.`;
};

const updateStatus = () => {
    const roleText = playerRole === "w" ? "White" : playerRole === "b" ? "Black" : "Spectator";
    roleElement.textContent = roleText;
    turnElement.textContent = getTurn() === "w" ? "White" : "Black";
    statusElement.textContent = getStatusText();
};

const renderCaptured = () => {
    const boardPieces = chess.board().flat().filter(Boolean);
    const startingCounts = { wp: 8, wn: 2, wb: 2, wr: 2, wq: 1, wk: 1, bp: 8, bn: 2, bb: 2, br: 2, bq: 1, bk: 1 };
    const currentCounts = { ...startingCounts };

    Object.keys(currentCounts).forEach((key) => {
        currentCounts[key] = 0;
    });

    boardPieces.forEach((piece) => {
        currentCounts[`${piece.color}${piece.type}`] += 1;
    });

    const capturedWhite = [];
    const capturedBlack = [];

    Object.entries(startingCounts).forEach(([key, count]) => {
        const missing = count - currentCounts[key];
        for (let i = 0; i < missing; i += 1) {
            if (key[0] === "w") capturedWhite.push({ color: "w", type: key[1] });
            else capturedBlack.push({ color: "b", type: key[1] });
        }
    });

    const byValue = (a, b) => pieceValues[b.type] - pieceValues[a.type];
    capturedWhiteElement.textContent = capturedWhite.sort(byValue).map(getPieceUnicode).join(" ");
    capturedBlackElement.textContent = capturedBlack.sort(byValue).map(getPieceUnicode).join(" ");
};

const clearSelection = () => {
    selectedSquare = null;
    sourceSquare = null;
    draggedPiece = null;
};

const choosePromotion = (move) => {
    pendingPromotionMove = move;
    promotionChoices.innerHTML = "";

    ["q", "r", "b", "n"].forEach((type) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "promotion-choice";
        button.textContent = getPieceUnicode({ color: playerRole || getTurn(), type });
        button.setAttribute("aria-label", `Promote to ${type.toUpperCase()}`);
        button.addEventListener("click", () => {
            socket.emit("move", { ...pendingPromotionMove, promotion: type });
            pendingPromotionMove = null;
            promotionDialog.classList.add("hidden");
        });
        promotionChoices.appendChild(button);
    });

    promotionDialog.classList.remove("hidden");
};

const needsPromotion = (move) => {
    const fromPiece = chess.get(move.from);
    return fromPiece &&
        fromPiece.type === "p" &&
        ((fromPiece.color === "w" && move.to.endsWith("8")) || (fromPiece.color === "b" && move.to.endsWith("1")));
};

const handleMove = (source, target) => {
    if (!source || !target) return;

    const move = {
        from: squareName(source),
        to: squareName(target)
    };
    const targetPiece = chess.get(move.to);

    if (targetPiece && canMovePiece(targetPiece)) {
        selectSquare(target, targetPiece);
        return;
    }

    if (move.from === move.to) {
        clearSelection();
        renderBoard();
        return;
    }

    const legalMove = legalMovesFrom(move.from).find((candidate) => candidate.to === move.to);
    if (!legalMove) {
        boardElement.classList.add("shake");
        window.setTimeout(() => boardElement.classList.remove("shake"), 220);
        clearSelection();
        renderBoard();
        return;
    }

    if (needsPromotion(move)) {
        choosePromotion(move);
        return;
    }

    socket.emit("move", move);
    clearSelection();
};

const selectSquare = (coords, piece) => {
    if (!canMovePiece(piece)) return;
    selectedSquare = coords;
    sourceSquare = coords;
    renderBoard();
};

const renderBoard = () => {
    const board = chess.board();
    const selectedName = selectedSquare ? squareName(selectedSquare) : null;
    const legalTargets = selectedName ? legalMovesFrom(selectedName).map((move) => move.to) : [];

    boardElement.innerHTML = "";

    board.forEach((row, rowIndex) => {
        row.forEach((square, squareIndex) => {
            const currentCoords = { row: rowIndex, col: squareIndex };
            const currentName = squareName(currentCoords);
            const squareElement = document.createElement("button");
            squareElement.type = "button";
            squareElement.classList.add("square", (rowIndex + squareIndex) % 2 === 0 ? "light" : "dark");
            squareElement.dataset.row = rowIndex;
            squareElement.dataset.col = squareIndex;
            squareElement.setAttribute("aria-label", currentName);

            if (selectedName === currentName) squareElement.classList.add("selected");
            if (legalTargets.includes(currentName)) squareElement.classList.add(square ? "capture-target" : "move-target");
            if (lastMove && (lastMove.from === currentName || lastMove.to === currentName)) squareElement.classList.add("last-move");

            if (square) {
                const pieceElement = document.createElement("span");
                pieceElement.classList.add("piece", square.color === "w" ? "white" : "black");
                pieceElement.textContent = getPieceUnicode(square);
                pieceElement.draggable = canMovePiece(square);

                if (pieceElement.draggable) pieceElement.classList.add("draggable");

                pieceElement.addEventListener("dragstart", (event) => {
                    if (!pieceElement.draggable) {
                        event.preventDefault();
                        return;
                    }

                    draggedPiece = pieceElement;
                    sourceSquare = currentCoords;
                    selectedSquare = currentCoords;
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", currentName);
                    window.requestAnimationFrame(() => pieceElement.classList.add("dragging"));
                });

                pieceElement.addEventListener("dragend", () => {
                    pieceElement.classList.remove("dragging");
                    clearSelection();
                    renderBoard();
                });

                squareElement.appendChild(pieceElement);
            }

            squareElement.addEventListener("dragover", (event) => {
                if (sourceSquare) event.preventDefault();
            });

            squareElement.addEventListener("drop", (event) => {
                event.preventDefault();
                if (draggedPiece || sourceSquare) handleMove(sourceSquare, currentCoords);
            });

            squareElement.addEventListener("click", () => {
                if (selectedSquare) {
                    handleMove(selectedSquare, currentCoords);
                    return;
                }

                selectSquare(currentCoords, square);
            });

            boardElement.appendChild(squareElement);
        });
    });

    boardElement.classList.toggle("flipped", playerRole === "b");
    renderCaptured();
    updateStatus();
};

socket.on("playerRole", (role) => {
    playerRole = role;
    renderBoard();
});

socket.on("spectatorRole", () => {
    playerRole = null;
    renderBoard();
});

socket.on("boardState", (state) => {
    const fen = typeof state === "string" ? state : state.fen;
    if (!chess.load(fen)) return;
    lastMove = typeof state === "object" ? state.lastMove : lastMove;
    clearSelection();
    renderBoard();
});

socket.on("invalidMove", () => {
    clearSelection();
    socket.emit("requestBoard");
});

socket.on("resetGame", () => {
    chess.reset();
    lastMove = null;
    clearSelection();
    renderBoard();
});

document.querySelector("[data-reset]")?.addEventListener("click", () => {
    socket.emit("resetGame");
});

promotionDialog?.addEventListener("click", (event) => {
    if (event.target === promotionDialog) {
        pendingPromotionMove = null;
        promotionDialog.classList.add("hidden");
    }
});

renderBoard();
