const canvas = document.getElementById("game");
    const ctx = canvas.getContext("2d");
    const restartBtn = document.getElementById("restartBtn");

    const box = 20;
    let snake, food, score, d, speed, gameOver;

    function init() {
      snake = [{ x: 9 * box, y: 10 * box }];
      food = randomFood();
      score = 0;
      d = null;
      speed = 150;
      gameOver = false;
      document.getElementById("score").textContent = "Puntaje: 0";
      draw();
    }

    function randomFood() {
      return {
        x: Math.floor(Math.random() * 19) * box,
        y: Math.floor(Math.random() * 19) * box
      };
    }

    // controles táctiles
    document.addEventListener("keydown", direction);
    document.getElementById("up").addEventListener("click", () => { if (d !== "DOWN") d = "UP"; });
    document.getElementById("down").addEventListener("click", () => { if (d !== "UP") d = "DOWN"; });
    document.getElementById("left").addEventListener("click", () => { if (d !== "RIGHT") d = "LEFT"; });
    document.getElementById("right").addEventListener("click", () => { if (d !== "LEFT") d = "RIGHT"; });
    restartBtn.addEventListener("click", init);

    // tecla R reinicia
    document.addEventListener("keydown", e => {
      if (e.key.toLowerCase() === "r") {
        init();
      }
    });

    function direction(event) {
      if (event.key === "ArrowLeft" && d !== "RIGHT") d = "LEFT";
      else if (event.key === "ArrowUp" && d !== "DOWN") d = "UP";
      else if (event.key === "ArrowRight" && d !== "LEFT") d = "RIGHT";
      else if (event.key === "ArrowDown" && d !== "UP") d = "DOWN";
    }

    function collision(head, array) {
      return array.some(segment => head.x === segment.x && head.y === segment.y);
    }

    function draw() {
      if (gameOver) return;

      ctx.fillStyle = "#2b2b2b60";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // snake
      for (let i = 0; i < snake.length; i++) {
        ctx.fillStyle = i === 0 ? "#00ff99" : "#00cc7a";
        ctx.fillRect(snake[i].x, snake[i].y, box, box);
        ctx.strokeStyle = "#1e1e1e";
        ctx.strokeRect(snake[i].x, snake[i].y, box, box);
      }

      // food
      ctx.fillStyle = "#f00";
      ctx.fillRect(food.x, food.y, box, box);

      let snakeX = snake[0].x;
      let snakeY = snake[0].y;

      if (d === "LEFT") snakeX -= box;
      if (d === "UP") snakeY -= box;
      if (d === "RIGHT") snakeX += box;
      if (d === "DOWN") snakeY += box;

      if (snakeX === food.x && snakeY === food.y) {
        score++;
        food = randomFood();
        if (score % 3 === 0 && speed > 60) {
          speed -= 10;
        }
      } else {
        snake.pop();
      }

      const newHead = { x: snakeX, y: snakeY };

      if (
        snakeX < 0 ||
        snakeY < 0 ||
        snakeX >= canvas.width ||
        snakeY >= canvas.height ||
        collision(newHead, snake)
      ) {
        gameOver = true;
        // mostramos "Game Over" en el canvas
        ctx.fillStyle = "rgba(0,0,0,0.7)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#fff";
        ctx.font = "30px Arial";
        ctx.textAlign = "center";
        ctx.fillText("GAME OVER", canvas.width / 2, canvas.height / 2);
        ctx.font = "20px Arial";
        ctx.fillText("Puntaje: " + score, canvas.width / 2, canvas.height / 2 + 30);
        ctx.fillText("Pulsa R o 🔄 para reiniciar", canvas.width / 2, canvas.height / 2 + 60);
        return;
      }

      snake.unshift(newHead);
      document.getElementById("score").textContent = "Puntaje: " + score;

      setTimeout(draw, speed);
    }

    // iniciar juego al cargar
    init();