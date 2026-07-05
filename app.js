const express = require("express")
const socket = require("socket.io")
const http = require("http")
const { Chess } = require("chess.js")
const path = require("path");

const app = express()

const server = http.createServer(app)
const io = socket(server)

let chess = new Chess()
let lastMove = null

let players = {}
app.set("view engine", "ejs")
app.use(express.static(path.join(__dirname, "public")))


app.get("/", (req, res) => {
    res.render("index", { title: "Chess Game" })
})

const isGameOver = () => {
    if (typeof chess.isGameOver === "function") return chess.isGameOver()
    if (typeof chess.game_over === "function") return chess.game_over()
    return false
}

const isCheck = () => {
    if (typeof chess.inCheck === "function") return chess.inCheck()
    if (typeof chess.in_check === "function") return chess.in_check()
    return false
}

const isCheckmate = () => {
    if (typeof chess.isCheckmate === "function") return chess.isCheckmate()
    if (typeof chess.in_checkmate === "function") return chess.in_checkmate()
    return false
}

const isDraw = () => {
    if (typeof chess.isDraw === "function") return chess.isDraw()
    if (typeof chess.in_draw === "function") return chess.in_draw()
    return false
}

const getBoardState = () => ({
    fen: chess.fen(),
    turn: chess.turn(),
    lastMove,
    status: {
        gameOver: isGameOver(),
        check: isCheck(),
        checkmate: isCheckmate(),
        draw: isDraw()
    }
})

const emitBoardState = () => {
    io.emit("boardState", getBoardState())
}

io.on("connection", function (uniquesocket) {
    console.log("connected")

    if (!players.white) {
        players.white = uniquesocket.id;
        uniquesocket.emit("playerRole","w")

    }
    else if (!players.black) {
        players.black = uniquesocket.id;
        uniquesocket.emit("playerRole","b")

    }
    else {
        uniquesocket.emit("spectatorRole")
    }

    uniquesocket.emit("boardState", getBoardState())

    uniquesocket.on("disconnect", function () {
        if (uniquesocket.id === players.white) delete players.white;
        else if (uniquesocket.id === players.black) delete players.black;

    })

    uniquesocket.on("requestBoard", () => {
        uniquesocket.emit("boardState", getBoardState())
    })

    uniquesocket.on("resetGame", () => {
        if (uniquesocket.id !== players.white && uniquesocket.id !== players.black) return

        chess = new Chess()
        lastMove = null
        emitBoardState()
    })

    uniquesocket.on("move", (move) => {
        try {
            if (!move || typeof move.from !== "string" || typeof move.to !== "string") return
            if (isGameOver()) return
            if (chess.turn() === "w" && uniquesocket.id !== players.white) return;
            if (chess.turn() === "b" && uniquesocket.id !== players.black) return;

            const normalizedMove = {
                from: move.from,
                to: move.to
            }

            if (move.promotion) normalizedMove.promotion = move.promotion

            const result = chess.move(normalizedMove)

            if (result) {
                lastMove = { from: result.from, to: result.to }
                emitBoardState()

            }
            else {
                console.log("Invalid move", normalizedMove)
                uniquesocket.emit("invalidMove", normalizedMove)

            }
        } catch (error) {
            console.log("Invalid move",move,error.message)
            uniquesocket.emit("invalidMove",move)
        }
    })
})

server.listen(3000, function () {
    console.log("ghee ghee ghee")
})
