import threading
import tkinter as tk
from tkinter import messagebox

import chess


# Material values in centipawns. Kings are not counted in material -
# their loss is handled by checkmate detection, not by score.
PIECE_VALUES = {
    chess.PAWN:   100,
    chess.KNIGHT: 320,
    chess.BISHOP: 330,
    chess.ROOK:   500,
    chess.QUEEN:  900,
    chess.KING:     0,
}

# Piece-square tables. These nudge the AI toward sensible positional play
# (knights to the centre, king tucked in the corner during the opening/middlegame, pawns rewarded for advancing, etc.).
# Values are from white's perspective, square index 0 = a1, 63 = h8.
PAWN_TABLE = [
     0,  0,  0,  0,  0,  0,  0,  0,
     5, 10, 10,-20,-20, 10, 10,  5,
     5, -5,-10,  0,  0,-10, -5,  5,
     0,  0,  0, 20, 20,  0,  0,  0,
     5,  5, 10, 25, 25, 10,  5,  5,
    10, 10, 20, 30, 30, 20, 10, 10,
    50, 50, 50, 50, 50, 50, 50, 50,
     0,  0,  0,  0,  0,  0,  0,  0,
]
KNIGHT_TABLE = [
    -50,-40,-30,-30,-30,-30,-40,-50,
    -40,-20,  0,  5,  5,  0,-20,-40,
    -30,  5, 10, 15, 15, 10,  5,-30,
    -30,  0, 15, 20, 20, 15,  0,-30,
    -30,  5, 15, 20, 20, 15,  5,-30,
    -30,  0, 10, 15, 15, 10,  0,-30,
    -40,-20,  0,  0,  0,  0,-20,-40,
    -50,-40,-30,-30,-30,-30,-40,-50,
]
BISHOP_TABLE = [
    -20,-10,-10,-10,-10,-10,-10,-20,
    -10,  5,  0,  0,  0,  0,  5,-10,
    -10, 10, 10, 10, 10, 10, 10,-10,
    -10,  0, 10, 10, 10, 10,  0,-10,
    -10,  5,  5, 10, 10,  5,  5,-10,
    -10,  0,  5, 10, 10,  5,  0,-10,
    -10,  0,  0,  0,  0,  0,  0,-10,
    -20,-10,-10,-10,-10,-10,-10,-20,
]
ROOK_TABLE = [
     0,  0,  0,  5,  5,  0,  0,  0,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
     5, 10, 10, 10, 10, 10, 10,  5,
     0,  0,  0,  0,  0,  0,  0,  0,
]
QUEEN_TABLE = [
    -20,-10,-10, -5, -5,-10,-10,-20,
    -10,  0,  5,  0,  0,  0,  0,-10,
    -10,  5,  5,  5,  5,  5,  0,-10,
      0,  0,  5,  5,  5,  5,  0, -5,
     -5,  0,  5,  5,  5,  5,  0, -5,
    -10,  0,  5,  5,  5,  5,  0,-10,
    -10,  0,  0,  0,  0,  0,  0,-10,
    -20,-10,-10, -5, -5,-10,-10,-20,
]
KING_TABLE = [
     20, 30, 10,  0,  0, 10, 30, 20,
     20, 20,  0,  0,  0,  0, 20, 20,
    -10,-20,-20,-20,-20,-20,-20,-10,
    -20,-30,-30,-40,-40,-30,-30,-20,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
]
PIECE_SQUARE_TABLES = {
    chess.PAWN:   PAWN_TABLE,
    chess.KNIGHT: KNIGHT_TABLE,
    chess.BISHOP: BISHOP_TABLE,
    chess.ROOK:   ROOK_TABLE,
    chess.QUEEN:  QUEEN_TABLE,
    chess.KING:   KING_TABLE,
}

MATE_SCORE = 1_000_000

AI_DEPTH = 3


def evaluate(board: chess.Board) -> int:
    """
    Return a static evaluation of the position in centipawns, from the
    perspective of the side to move. Positive means the side to move
    is better.
    """
    # Terminal positions first - these short-circuit the search cleanly.
    if board.is_checkmate():
        # Side to move is mated; very bad for them.
        return -MATE_SCORE
    if board.is_stalemate() or board.is_insufficient_material():
        return 0

    score = 0
    for square, piece in board.piece_map().items():
        value = PIECE_VALUES[piece.piece_type]
        # Piece-square table: index from white's perspective for white
        # pieces, mirror vertically for black pieces.
        pst_index = square if piece.color == chess.WHITE else chess.square_mirror(square)
        positional = PIECE_SQUARE_TABLES[piece.piece_type][pst_index]
        signed = (value + positional)
        score += signed if piece.color == chess.WHITE else -signed

    # Flip if it's black's turn so the score is from the mover's POV.
    return score if board.turn == chess.WHITE else -score


def _order_moves(board: chess.Board):
    """
    Move ordering for alpha-beta. Captures are tried first (MVV-LVA-ish),
    then the rest. Good ordering makes alpha-beta cut far more branches.
    """
    moves = list(board.legal_moves)

    def score(move):
        # Promotions first, then captures (most valuable victim - least valuable attacker), then quiet moves.
        s = 0
        if move.promotion:
            s += 10_000
        if board.is_capture(move):
            victim = board.piece_at(move.to_square)
            attacker = board.piece_at(move.from_square)
            if victim is not None:
                s += 1000 + PIECE_VALUES[victim.piece_type]
            if attacker is not None:
                s -= PIECE_VALUES[attacker.piece_type] // 10
        return -s  # we sort ascending, so negate for highest-first

    moves.sort(key=score)
    return moves


def _negamax(board: chess.Board, depth: int, alpha: int, beta: int) -> int:
    """
    Negamax variant of minimax with alpha-beta pruning.

    Both sides try to maximise their own score; we negate when we
    descend, so a single routine handles both colours.
    """
    if depth == 0 or board.is_game_over():
        return evaluate(board)

    best = -10 * MATE_SCORE
    for move in _order_moves(board):
        board.push(move)
        # Children's score is from THEIR POV, so negate to convert to ours.
        score = -_negamax(board, depth - 1, -beta, -alpha)
        board.pop()

        if score > best:
            best = score
        if best > alpha:
            alpha = best
        if alpha >= beta:
            break  # beta cutoff
    return best


def find_best_move(board: chess.Board, depth: int = 3) -> chess.Move | None:
    """
    Top-level search: returns the best legal move for the side to move,
    or None if there are no legal moves (mate / stalemate).
    """
    best_move = None
    best_score = -10 * MATE_SCORE
    alpha, beta = -10 * MATE_SCORE, 10 * MATE_SCORE

    for move in _order_moves(board):
        board.push(move)
        score = -_negamax(board, depth - 1, -beta, -alpha)
        board.pop()

        if score > best_score:
            best_score = score
            best_move = move
        if best_score > alpha:
            alpha = best_score
    return best_move


# GUI

SQUARE_SIZE = 64
BOARD_PX = SQUARE_SIZE * 8

# Colours - pleasant wood-board palette with clear highlights.
LIGHT_SQ      = "#f0d9b5"
DARK_SQ       = "#b58863"
SELECTED      = "#f6f669"
LEGAL_DOT     = "#7fb069"
LAST_MOVE     = "#cdd17a"
CHECK_SQ      = "#e06c75"
BG            = "#1e1e2e"
FG            = "#cdd6f4"
FG_DIM        = "#a6adc8"

# Unicode chess pieces. Uppercase = white, lowercase = black, matching
# python-chess's symbol convention.
PIECE_GLYPHS = {
    "P": "\u2659", "N": "\u2658", "B": "\u2657",
    "R": "\u2656", "Q": "\u2655", "K": "\u2654",
    "p": "\u265F", "n": "\u265E", "b": "\u265D",
    "r": "\u265C", "q": "\u265B", "k": "\u265A",
}


class ChessGame(tk.Toplevel):
    """
    The chess GUI. Subclass of Toplevel so it can be opened from another
    Tk window (e.g. the 2FA login window). When run standalone, the main
    block below creates a hidden root before instantiating this.

    The human always plays White; the AI plays Black. (Easy to swap if
    you want; see new_game.)
    """

    def __init__(self, master, user=None):
        super().__init__(master)
        self.user = user or {"username": "guest"}

        username = self.user.get("username", "guest")
        self.title(f"FIT5163 Chess Game - logged in as {username}")
        self.configure(bg=BG)
        self.resizable(False, False)

        # Authoritative game state.
        self.board = chess.Board()
        self.selected_square = None
        self.legal_targets = set()
        self.ai_thinking = False
        self.human_color = chess.WHITE

        self._build_ui()
        self.draw_board()

        # Make sure closing the window cleanly terminates the loop when
        # this is run standalone.
        self.protocol("WM_DELETE_WINDOW", self._on_close)

    # UI scaffolding
    def _build_ui(self):
        # Top bar: status text on the left, control buttons on the right.
        top = tk.Frame(self, bg=BG)
        top.pack(fill="x", padx=10, pady=8)

        self.status_label = tk.Label(
            top, text="White to move", fg=FG, bg=BG,
            font=("Helvetica", 13, "bold"),
        )
        self.status_label.pack(side="left")

        for label, command, color in [
            ("New game",   self.new_game,   "#a6e3a1"),
            ("Undo",       self.undo_move,  "#f9e2af"),
            ("Resign",     self.resign,     "#f38ba8"),
            ("Quit",       self._on_close,  "#cba6f7"),
        ]:
            tk.Button(
                top, text=label, command=command,
                bg=color, fg=BG, relief="flat",
                font=("Helvetica", 10, "bold"),
                padx=10, pady=4, cursor="hand2",
            ).pack(side="right", padx=3)

        # Main horizontal split: board on the left, move list on the right.
        main = tk.Frame(self, bg=BG)
        main.pack(padx=10, pady=4)

        self.canvas = tk.Canvas(
            main, width=BOARD_PX, height=BOARD_PX,
            bg=BG, highlightthickness=0,
        )
        self.canvas.pack(side="left")
        self.canvas.bind("<Button-1>", self.on_click)

        # Move list on the right.
        side = tk.Frame(main, bg=BG)
        side.pack(side="left", fill="y", padx=(12, 0))
        tk.Label(side, text="Moves", fg=FG, bg=BG,
                 font=("Helvetica", 11, "bold")).pack(anchor="w")

        list_frame = tk.Frame(side, bg=BG)
        list_frame.pack(fill="y", expand=True, pady=(4, 0))
        self.moves_list = tk.Listbox(
            list_frame, bg="#313244", fg=FG,
            font=("Courier", 11), width=22, height=20,
            relief="flat", selectbackground="#45475a",
        )
        self.moves_list.pack(side="left", fill="y")
        sb = tk.Scrollbar(list_frame, command=self.moves_list.yview)
        sb.pack(side="left", fill="y")
        self.moves_list.config(yscrollcommand=sb.set)

        # Footer: who's playing whom.
        footer = tk.Label(
            self,
            text=f"You: White  -  AI (depth {AI_DEPTH}): Black",
            fg=FG_DIM, bg=BG, font=("Helvetica", 9, "italic"),
        )
        footer.pack(pady=(4, 8))

    # Drawing
    def draw_board(self):
        """Re-render the entire board from the current board state."""
        self.canvas.delete("all")

        # Highlight the from/to squares of the most recent move.
        last_move = self.board.peek() if self.board.move_stack else None
        # Highlight the king's square if it's in check.
        king_in_check_sq = self.board.king(self.board.turn) if self.board.is_check() else None

        for display_rank in range(8):
            for display_file in range(8):
                # python-chess square index: 0 = a1, 63 = h8.
                # Our display has rank 8 at the top, rank 1 at the bottom.
                sq = chess.square(display_file, 7 - display_rank)
                x1 = display_file * SQUARE_SIZE
                y1 = display_rank * SQUARE_SIZE

                # Decide the colour of this square. Priority:
                # check > selected > last-move > base colour.
                base = LIGHT_SQ if (display_file + display_rank) % 2 == 0 else DARK_SQ
                color = base
                if last_move and sq in (last_move.from_square, last_move.to_square):
                    color = LAST_MOVE
                if sq == self.selected_square:
                    color = SELECTED
                if sq == king_in_check_sq:
                    color = CHECK_SQ

                self.canvas.create_rectangle(
                    x1, y1, x1 + SQUARE_SIZE, y1 + SQUARE_SIZE,
                    fill=color, outline=color,
                )

                # File / rank labels in the corners (algebraic coords).
                if display_file == 0:
                    self.canvas.create_text(
                        x1 + 4, y1 + 4, anchor="nw",
                        text=str(8 - display_rank),
                        fill="#444", font=("Helvetica", 8, "bold"),
                    )
                if display_rank == 7:
                    self.canvas.create_text(
                        x1 + SQUARE_SIZE - 4, y1 + SQUARE_SIZE - 4,
                        anchor="se",
                        text=chr(ord("a") + display_file),
                        fill="#444", font=("Helvetica", 8, "bold"),
                    )

                piece = self.board.piece_at(sq)
                if piece is not None:
                    self.canvas.create_text(
                        x1 + SQUARE_SIZE / 2, y1 + SQUARE_SIZE / 2,
                        text=PIECE_GLYPHS[piece.symbol()],
                        font=("Helvetica", 40),
                        fill="#000" if piece.color == chess.WHITE else "#222",
                    )

        # Legal-move dots for the currently picked-up piece.
        for sq in self.legal_targets:
            display_file = chess.square_file(sq)
            display_rank = 7 - chess.square_rank(sq)
            cx = display_file * SQUARE_SIZE + SQUARE_SIZE / 2
            cy = display_rank * SQUARE_SIZE + SQUARE_SIZE / 2
            r = 9
            self.canvas.create_oval(
                cx - r, cy - r, cx + r, cy + r,
                fill=LEGAL_DOT, outline=LEGAL_DOT,
            )

        self._update_status()
        self._update_moves_list()

    def _update_status(self):
        if self.ai_thinking:
            self.status_label.config(text="AI is thinking...")
            return
        if self.board.is_checkmate():
            winner = "Black" if self.board.turn == chess.WHITE else "White"
            self.status_label.config(text=f"Checkmate - {winner} wins")
        elif self.board.is_stalemate():
            self.status_label.config(text="Stalemate - draw")
        elif self.board.is_insufficient_material():
            self.status_label.config(text="Draw - insufficient material")
        elif self.board.can_claim_threefold_repetition():
            self.status_label.config(text="Draw available (3-fold repetition)")
        elif self.board.is_check():
            mover = "White" if self.board.turn == chess.WHITE else "Black"
            self.status_label.config(text=f"{mover} to move - check!")
        else:
            mover = "White" if self.board.turn == chess.WHITE else "Black"
            self.status_label.config(text=f"{mover} to move")

    def _update_moves_list(self):
        """Render the move stack in SAN, grouped as 1. e4 e5 / 2. Nf3 Nc6 ..."""
        self.moves_list.delete(0, tk.END)
        replay = chess.Board()
        sans = []
        for mv in self.board.move_stack:
            sans.append(replay.san(mv))
            replay.push(mv)
        for i in range(0, len(sans), 2):
            move_num = i // 2 + 1
            white = sans[i]
            black = sans[i + 1] if i + 1 < len(sans) else ""
            self.moves_list.insert(tk.END, f"{move_num:>3}. {white:<7} {black}")
        self.moves_list.yview_moveto(1.0)

    # Interaction
    def on_click(self, event):
        # Block input while the AI is searching or after the game ends.
        if self.ai_thinking or self.board.is_game_over():
            return
        # Only let the human move pieces of their own colour.
        if self.board.turn != self.human_color:
            return

        display_file = event.x // SQUARE_SIZE
        display_rank = event.y // SQUARE_SIZE
        if not (0 <= display_file < 8 and 0 <= display_rank < 8):
            return
        sq = chess.square(display_file, 7 - display_rank)

        if self.selected_square is None:
            # First click - try to pick up a piece.
            piece = self.board.piece_at(sq)
            if piece and piece.color == self.board.turn:
                self.selected_square = sq
                self.legal_targets = {
                    m.to_square for m in self.board.legal_moves
                    if m.from_square == sq
                }
        else:
            if sq == self.selected_square:
                # Clicked the same square -> deselect.
                self.selected_square = None
                self.legal_targets = set()
            elif sq in self.legal_targets:
                # Valid destination -> make the move.
                self._try_move(self.selected_square, sq)
                self.selected_square = None
                self.legal_targets = set()
            else:
                # Maybe switching to another of the player's pieces.
                piece = self.board.piece_at(sq)
                if piece and piece.color == self.board.turn:
                    self.selected_square = sq
                    self.legal_targets = {
                        m.to_square for m in self.board.legal_moves
                        if m.from_square == sq
                    }
                else:
                    self.selected_square = None
                    self.legal_targets = set()

        self.draw_board()

    def _try_move(self, from_sq, to_sq):
        promotion = None
        piece = self.board.piece_at(from_sq)
        to_rank = chess.square_rank(to_sq)
        if (piece is not None and piece.piece_type == chess.PAWN
                and to_rank in (0, 7)):
            promotion = self._ask_promotion()
            if promotion is None:
                return  # cancelled

        move = chess.Move(from_sq, to_sq, promotion=promotion)
        if move in self.board.legal_moves:
            self.board.push(move)
            # If that ended the game, announce; otherwise let the AI reply.
            if self.board.is_game_over():
                self.after(50, self._announce_game_over)
            else:
                self.after(120, self._trigger_ai_move)

    def _ask_promotion(self):
        dlg = tk.Toplevel(self)
        dlg.title("Promote pawn")
        dlg.configure(bg=BG)
        dlg.transient(self)
        dlg.grab_set()
        result = {"piece": None}

        def choose(p):
            result["piece"] = p
            dlg.destroy()

        tk.Label(
            dlg, text="Promote to:",
            fg=FG, bg=BG, font=("Helvetica", 11),
        ).pack(padx=20, pady=10)

        row = tk.Frame(dlg, bg=BG)
        row.pack(padx=20, pady=10)
        for label, p in [
            ("Queen",  chess.QUEEN),
            ("Rook",   chess.ROOK),
            ("Bishop", chess.BISHOP),
            ("Knight", chess.KNIGHT),
        ]:
            tk.Button(
                row, text=label,
                command=lambda p=p: choose(p),
                bg="#89b4fa", fg=BG, relief="flat",
                font=("Helvetica", 10, "bold"),
                padx=10, pady=4,
            ).pack(side="left", padx=4)

        self.wait_window(dlg)
        return result["piece"]

    # AI move
    def _trigger_ai_move(self):
        """
        Search runs in a background thread so the GUI stays responsive.
        We can't touch Tk from a worker thread, so the worker just stores
        the chosen move and the GUI thread polls for it via .after().
        """
        if self.board.is_game_over():
            return
        self.ai_thinking = True
        self._update_status()
        # Snapshot the board to avoid races; the search mutates push/pop
        # on its own copy.
        board_copy = self.board.copy(stack=False)
        depth = AI_DEPTH
        result_holder = {"move": None, "done": False}

        def worker():
            try:
                result_holder["move"] = find_best_move(board_copy, depth=depth)
            finally:
                result_holder["done"] = True

        threading.Thread(target=worker, daemon=True).start()
        self.after(50, self._poll_ai, result_holder)

    def _poll_ai(self, result_holder):
        if not result_holder["done"]:
            self.after(50, self._poll_ai, result_holder)
            return
        move = result_holder["move"]
        self.ai_thinking = False
        if move is None or move not in self.board.legal_moves:
            # No move (shouldn't happen unless game over) - just refresh.
            self.draw_board()
            return
        self.board.push(move)
        self.draw_board()
        if self.board.is_game_over():
            self.after(50, self._announce_game_over)

    # End of game / controls
    def _announce_game_over(self):
        if self.board.is_checkmate():
            winner = "Black" if self.board.turn == chess.WHITE else "White"
            who = "You win!" if (winner == "White") == (self.human_color == chess.WHITE) else "AI wins."
            messagebox.showinfo("Game over", f"Checkmate - {winner} wins. {who}")
        elif self.board.is_stalemate():
            messagebox.showinfo("Game over", "Stalemate - the game is a draw.")
        elif self.board.is_insufficient_material():
            messagebox.showinfo("Game over", "Draw - insufficient material.")
        else:
            messagebox.showinfo("Game over", "Game drawn.")

    def new_game(self):
        if self.ai_thinking:
            return
        if not messagebox.askyesno("New game", "Start a new game?"):
            return
        self.board.reset()
        self.selected_square = None
        self.legal_targets = set()
        self.draw_board()

    def undo_move(self):
        if self.ai_thinking:
            return
        # Pop AI move, then human move, if available.
        if self.board.move_stack:
            self.board.pop()
        if self.board.move_stack and self.board.turn != self.human_color:
            self.board.pop()
        self.selected_square = None
        self.legal_targets = set()
        self.draw_board()

    def resign(self):
        if self.ai_thinking:
            return
        if messagebox.askyesno("Resign", "Resign this game and start a new one?"):
            self.board.reset()
            self.selected_square = None
            self.legal_targets = set()
            self.draw_board()

    def _on_close(self):
        self.destroy()
        # If this is the only window (standalone mode), shut Tk down too.
        try:
            if self.master and not self.master.winfo_exists():
                return
            # If master is a hidden root with no other children, kill it.
            if self.master and len(self.master.winfo_children()) == 0:
                self.master.destroy()
        except Exception:
            pass


# Public API for teammate's 2FA module
def launch_chess(user):
    """
    Open the chess game for an authenticated user.
    """
    # Detect whether there's already a running Tk root in this process.
    existing_root = tk._default_root
    if existing_root is None:
        root = tk.Tk()
        root.withdraw()
        game = ChessGame(root, user=user)
        game.attributes('-topmost', True)
        game.update()
        game.attributes('-topmost', False)
        root.mainloop()
    else:
        # A root exists; just open the chess window inside the running loop.
        game = ChessGame(existing_root, user=user)
    return game

def attempt_login():
    from login_callback import (
        wait_for_login_callback,
        verify_login_with_backend,
        LoginCallbackError,
    )

    try:
        result = wait_for_login_callback()
    except LoginCallbackError as exc:
        raise SystemExit(f"2FA login failed or timed out: {exc}")

    try:
        token_ok = verify_login_with_backend(result)
    except LoginCallbackError as exc:
        raise SystemExit(f"Could not verify login: {exc}")

    if not token_ok:
        raise SystemExit("Login token rejected by the backend - access denied.")

    return result


if __name__ == "__main__":
    result = attempt_login()
    launch_chess({"username": result.username})
