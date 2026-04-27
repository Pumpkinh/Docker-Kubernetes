import os
import random
import secrets
from datetime import datetime, timezone

import psycopg2
from psycopg2.extras import RealDictCursor
from flask import Flask, make_response, render_template, request, session

app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY", "dev-secret-key")


def get_db_connection():
    return psycopg2.connect(
        dbname=os.getenv("POSTGRES_DB"),
        user=os.getenv("POSTGRES_USER"),
        password=os.getenv("POSTGRES_PASSWORD"),
        host=os.getenv("POSTGRES_HOST", "db"),
        port=os.getenv("POSTGRES_PORT", "5432"),
    )


def get_or_create_player_id():
    player_id = request.cookies.get("player_id")
    if not player_id:
        player_id = secrets.token_hex(16)
    return player_id


def init_game():
    if "target_number" not in session:
        session["target_number"] = random.randint(1, 100)
        session["attempts"] = 0


def reset_game():
    session.pop("target_number", None)
    session.pop("attempts", None)


def serialize_history_rows(rows):
    serialized_rows = []

    for row in rows:
        played_at = row["played_at"]
        played_at_utc = played_at.replace(tzinfo=timezone.utc)

        serialized_rows.append(
            {
                "id": row["id"],
                "attempts": row["attempts"],
                "played_at_iso": played_at_utc.isoformat().replace("+00:00", "Z"),
                "played_at_display": played_at_utc.strftime("%d.%m.%Y %H:%M UTC"),
            }
        )

    return serialized_rows


@app.route("/health")
def health():
    return {"status": "healthy"}, 200


@app.route("/", methods=["GET", "POST"])
def index():
    player_id = get_or_create_player_id()
    init_game()

    message = "Вгадай число від 1 до 100"
    result_type = "info"
    last_guess = ""

    if request.method == "POST":
        if "restart" in request.form:
            reset_game()
            init_game()
            message = "Гру перезапущено. Вгадай нове число від 1 до 100"
            result_type = "info"
        else:
            guess_raw = request.form.get("guess", "").strip()
            last_guess = guess_raw

            try:
                guess = int(guess_raw)

                if guess < 1 or guess > 100:
                    message = "Введи число в діапазоні 1–100."
                    result_type = "error"
                else:
                    session["attempts"] += 1
                    target = session["target_number"]

                    if guess < target:
                        message = "Загадане число більше."
                        result_type = "warning"
                    elif guess > target:
                        message = "Загадане число менше."
                        result_type = "warning"
                    else:
                        attempts = session["attempts"]

                        try:
                            conn = get_db_connection()
                            cur = conn.cursor()
                            cur.execute(
                                """
                                INSERT INTO game_results (player_id, attempts, played_at)
                                VALUES (%s, %s, %s)
                                """,
                                (player_id, attempts, datetime.now(timezone.utc)),
                            )
                            conn.commit()
                            cur.close()
                            conn.close()

                            message = f"Вітаю! Ти вгадав число за {attempts} спроб."
                            result_type = "success"
                        except Exception as e:
                            message = f"Вгадав за {attempts} спроб, але БД не записала результат."
                            result_type = "error"
                            print("DB ERROR:", e)

                        reset_game()
                        init_game()
                        last_guess = ""

            except ValueError:
                message = "Введи коректне число."
                result_type = "error"

    stats = {"games_played": 0, "best_result": None}
    history = []

    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        cur.execute("""
            SELECT COUNT(*) AS games_played, MIN(attempts) AS best_result
            FROM game_results
            WHERE player_id = %s
        """, (player_id,))
        row = cur.fetchone()

        if row:
            stats["games_played"] = row["games_played"] or 0
            stats["best_result"] = row["best_result"]

        cur.execute("""
            SELECT id, attempts, played_at
            FROM game_results
            WHERE player_id = %s
            ORDER BY played_at DESC
            LIMIT 10
        """, (player_id,))
        history = serialize_history_rows(cur.fetchall())

        cur.close()
        conn.close()

    except Exception as e:
        print("DB READ ERROR:", e)

    response = make_response(
        render_template(
            "index.html",
            message=message,
            result_type=result_type,
            attempts=session.get("attempts", 0),
            stats=stats,
            history=history,
            player_id_short=player_id[:8],
            last_guess=last_guess,
        )
    )

    if not request.cookies.get("player_id"):
        response.set_cookie(
            "player_id",
            player_id,
            max_age=60 * 60 * 24 * 365,
            httponly=True,
            samesite="Lax",
        )

    return response


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
    
