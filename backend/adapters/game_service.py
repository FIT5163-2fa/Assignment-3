from sqlalchemy.orm import Session

from backend.adapters.models import Games, GameResult, GameStatus, PlayerSide


def create_game(
    db: Session,
    user_id: int,
    player_side: PlayerSide = PlayerSide.WHITE,
    ai_depth: int = 3,
    moves: str = "",
) -> Games:
    game = Games(
        user_id=user_id,
        player_side=player_side,
        ai_depth=ai_depth,
        moves=moves,
    )
    db.add(game)
    db.commit()
    db.refresh(game)
    return game


def get_game(db: Session, game_id: int) -> Games | None:
    return db.query(Games).filter(Games.id == game_id).first()


def get_games_by_user(db: Session, user_id: int) -> list[Games]:
    return db.query(Games).filter(Games.user_id == user_id).all()


def get_all_games(db: Session) -> list[Games]:
    return db.query(Games).all()


def update_game(
    db: Session,
    game_id: int,
    player_side: PlayerSide | None = None,
    ai_depth: int | None = None,
    moves: str | None = None,
    status: GameStatus | None = None,
    result: GameResult | None = None,
    final_fen: str | None = None,
) -> Games | None:
    game = get_game(db, game_id)
    if not game:
        return None

    if player_side is not None:
        game.player_side = player_side
    if ai_depth is not None:
        game.ai_depth = ai_depth
    if moves is not None:
        game.moves = moves
    if status is not None:
        game.status = status
    if result is not None:
        game.result = result
    if final_fen is not None:
        game.final_fen = final_fen

    db.commit()
    db.refresh(game)
    return game


def update_game_moves(db: Session, game_id: int, moves: str) -> Games | None:
    game = get_game(db, game_id)
    if not game:
        return None

    game.moves = moves
    db.commit()
    db.refresh(game)
    return game


def append_game_move(db: Session, game_id: int, move: str) -> Games | None:
    game = get_game(db, game_id)
    if not game:
        return None

    if game.moves:
        game.moves = f"{game.moves} {move}"
    else:
        game.moves = move

    db.commit()
    db.refresh(game)
    return game


def finish_game(
    db: Session,
    game_id: int,
    status: GameStatus,
    result: GameResult | None = None,
    final_fen: str | None = None,
) -> Games | None:
    game = get_game(db, game_id)
    if not game:
        return None

    game.status = status
    game.result = result
    game.final_fen = final_fen
    db.commit()
    db.refresh(game)
    return game


def delete_game(db: Session, game_id: int) -> bool:
    game = get_game(db, game_id)
    if not game:
        return False

    db.delete(game)
    db.commit()
    return True
