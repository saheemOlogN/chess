const socket = io()
const chess = new Chess()
const boardElement = document.querySelector(".chessboard")

let draggedPiece = null
let sourceSquare = null
let playerRole = null

const renderBoard = () => {
    const board = chess.board()
    board.innerHTML = ""
    board.forEach((row, rowIndex) => {
        row.forEach((square, squareIndex) => {
            const squareElement = document.createElement("div")
            squareElement.classList.add("square",
                (rowIndex + squareIndex) % 2 === 0 ? "light" : "dark"
            )
        })
        squareElement.dataset.row = rowIndex
        squareElement.dataset.square = squareIndex

        if (square) {
            const pieceElement = document.createElement("div")
            pieceElement.classList.add("piece", square.color = 'w' ? 'white' : "black")
            pieceElement.innerText = ""
            pieceElement.draggable = playerRole === square.color

            pieceElement.addEventListener("dragstart", (e) => {
                if (pieceElement.draggable) {
                    draggedPiece = pieceElement
                    sourceSquare = { row: rowIndex, col: squareIndex }
                    e.dataTransfer.setData("text/plain", "")
                }

            })
            pieceElement.addEventListener("dargend", (e) => {
                deaggedPiece = null
                sourceSquare = null

            })

            squareElement.appendChild(pieceElement)
        }
        squareElement.addEventListener("dragover",(e)=>{
            e.preventDefault();
        })
        squareElement.addEventListener("drop",(e)=>{
            e.preventDefault()
            if(draggedPiece){
                const targetSource = {
                    row: parseInt(squareElement.dataset.row),
                    col:parseInt(squareElement.dataset.col)
                }

                handleMove(sourceSquare,targetSource)
            }
            
        })
        boardElement.appendChild(squareElement)


    })

}

renderBoard()
const handleMove = () => {

}

const getPieceUniCode = () => {

}