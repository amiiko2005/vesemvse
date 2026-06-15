(() => {
  function initGame() {
    if (!CanvasRenderingContext2D.prototype.roundRect) {
      CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
        const radius = typeof r === 'number' ? r : 0;
        this.moveTo(x + radius, y);
        this.lineTo(x + w - radius, y);
        this.quadraticCurveTo(x + w, y, x + w, y + radius);
        this.lineTo(x + w, y + h - radius);
        this.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
        this.lineTo(x + radius, y + h);
        this.quadraticCurveTo(x, y + h, x, y + h - radius);
        this.lineTo(x, y + radius);
        this.quadraticCurveTo(x, y, x + radius, y);
        this.closePath();
      };
    }

    const COLS = 13;
    const ROWS = 10;

    const VAN = {
      w: 760,
      h: 420,
      cargoX: 152,
      cargoY: 78,
      cargoW: 548,
      cargoH: 250,
      floorY: 328
    };

    const CELL_W = VAN.cargoW / COLS;
    const CELL_H = VAN.cargoH / ROWS;

    const PIECES = {
      I: { name: 'Кровать', emoji: '🛏️', color: '#5b8fd4', edge: '#3d6fa8', cells: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]] },
      O: { name: 'Коробка', emoji: '📦', color: '#c8842a', edge: '#8f5e15', cells: [[1,1],[1,1]] },
      T: { name: 'Шкаф', emoji: '🗄️', color: '#7c6b9e', edge: '#564a72', cells: [[0,1,0],[1,1,1],[0,0,0]] },
      L: { name: 'Диван', emoji: '🛋️', color: '#3d9e78', edge: '#267a5c', cells: [[0,0,1],[1,1,1],[0,0,0]] },
      J: { name: 'Комод', emoji: '🪑', color: '#c96b8a', edge: '#9a4560', cells: [[1,0,0],[1,1,1],[0,0,0]] },
      S: { name: 'Стол', emoji: '🪵', color: '#b8923a', edge: '#8a6820', cells: [[0,1,1],[1,1,0],[0,0,0]] },
      Z: { name: 'Техника', emoji: '📺', color: '#d07040', edge: '#a04e28', cells: [[1,1,0],[0,1,1],[0,0,0]] }
    };

    const KEYS = ['I', 'O', 'T', 'L', 'J', 'S', 'Z'];

    const canvas = document.getElementById('gameCanvas');
    const nextCanvas = document.getElementById('gameNext');
    const scoreEl = document.getElementById('gameScore');
    const linesEl = document.getElementById('gameLines');
    const levelEl = document.getElementById('gameLevel');
    const nextNameEl = document.getElementById('gameNextName');
    const overlayEl = document.getElementById('gameOverlay');
    const overlayTitleEl = document.getElementById('gameOverlayTitle');
    const overlayTextEl = document.getElementById('gameOverlayText');
    const rewardEl = document.getElementById('gameReward');
    const startBtn = document.getElementById('gameStartBtn');

    if (!canvas || !nextCanvas || !startBtn || !rewardEl) return;

    const DISCOUNT_SCORE = 999;

    const ctx = canvas.getContext('2d');
    const nextCtx = nextCanvas.getContext('2d');

    canvas.width = VAN.w;
    canvas.height = VAN.h;

    let board, current, next, score, lines, level, dropInterval, lastDrop, gameRunning, paused;
    let discountUnlocked = false;
    let pausedForReward = false;

    function gridToScreen(col, row) {
      return {
        x: VAN.cargoX + col * CELL_W,
        y: VAN.cargoY + row * CELL_H,
        w: CELL_W,
        h: CELL_H
      };
    }

    function emptyBoard() {
      return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    }

    function randomPiece() {
      const key = KEYS[Math.floor(Math.random() * KEYS.length)];
      return { key, rotation: 0, row: 0, col: Math.floor(COLS / 2) - 1 };
    }

    function getCells(piece) {
      const base = PIECES[piece.key].cells;
      let m = base.map(r => [...r]);
      for (let i = 0; i < piece.rotation; i++) {
        m = m[0].map((_, ci) => m.map(row => row[ci]).reverse());
      }
      return m;
    }

    function countFilledCells(cells) {
      return cells.reduce((sum, row) => sum + row.filter(Boolean).length, 0);
    }

    function collides(piece, rowOff = 0, colOff = 0) {
      const cells = getCells(piece);
      for (let r = 0; r < cells.length; r++) {
        for (let c = 0; c < cells[r].length; c++) {
          if (!cells[r][c]) continue;
          const nr = piece.row + r + rowOff;
          const nc = piece.col + c + colOff;
          if (nc < 0 || nc >= COLS || nr >= ROWS) return true;
          if (nr >= 0 && board[nr][nc]) return true;
        }
      }
      return false;
    }

    function lockPiece() {
      const cells = getCells(current);
      const info = PIECES[current.key];
      score += countFilledCells(cells);
      for (let r = 0; r < cells.length; r++) {
        for (let c = 0; c < cells[r].length; c++) {
          if (!cells[r][c]) continue;
          const nr = current.row + r;
          const nc = current.col + c;
          if (nr >= 0) board[nr][nc] = { key: current.key, color: info.color, edge: info.edge, emoji: info.emoji };
        }
      }
      clearLines();
      updateHUD();
      spawnPiece();
    }

    function clearLines() {
      let cleared = 0;
      for (let r = ROWS - 1; r >= 0; r--) {
        if (board[r].every(cell => cell)) {
          board.splice(r, 1);
          board.unshift(Array(COLS).fill(null));
          cleared++;
          r++;
        }
      }
      if (cleared) {
        lines += cleared;
        score += cleared * 10;
        level = Math.floor(lines / 5) + 1;
        dropInterval = Math.max(120, 650 - (level - 1) * 55);
      }
    }

    function spawnPiece() {
      current = next || randomPiece();
      next = randomPiece();
      current.row = 0;
      current.col = Math.floor(COLS / 2) - 1;
      if (collides(current)) endGame();
      drawNext();
    }

    function move(dir) {
      if (!gameRunning || paused) return;
      const colOff = dir === 'left' ? -1 : dir === 'right' ? 1 : 0;
      const rowOff = dir === 'down' ? 1 : 0;
      if (!collides(current, rowOff, colOff)) {
        current.row += rowOff;
        current.col += colOff;
      } else if (dir === 'down') {
        lockPiece();
      }
    }

    function rotate() {
      if (!gameRunning || paused) return;
      const prev = current.rotation;
      current.rotation = (current.rotation + 1) % 4;
      if (collides(current)) {
        for (const kick of [1, -1, 2, -2]) {
          current.col += kick;
          if (!collides(current)) return;
          current.col -= kick;
        }
        current.rotation = prev;
      }
    }

    function hardDrop() {
      if (!gameRunning || paused) return;
      while (!collides(current, 1, 0)) {
        current.row++;
      }
      lockPiece();
    }

    function updateHUD() {
      scoreEl.textContent = score;
      linesEl.textContent = lines;
      levelEl.textContent = level;
      nextNameEl.textContent = next ? PIECES[next.key].name + ' ' + PIECES[next.key].emoji : '—';
      checkDiscountUnlock();
    }

    function checkDiscountUnlock() {
      if (!gameRunning || discountUnlocked || score < DISCOUNT_SCORE) return;
      discountUnlocked = true;
      paused = true;
      pausedForReward = true;
      showDiscountReward();
    }

    function showDiscountReward() {
      rewardEl.hidden = false;
      overlayEl.hidden = false;
      overlayTitleEl.textContent = 'Поздравляем!';
      overlayTextEl.textContent =
        `Вы набрали ${score} очков и открыли скидку 5% на перевозку.\n\n` +
        '📸 Сделайте скриншот этого экрана (с очками и значком −5%) и отправьте нам в Telegram или MAX при заказе — мы применим скидку.';
      startBtn.textContent = 'Продолжить игру';
      draw();
    }

    function showDiscountEnd() {
      rewardEl.hidden = false;
      overlayEl.hidden = false;
      overlayTitleEl.textContent = 'Газель переполнена';
      overlayTextEl.textContent =
        `Упаковано рядов: ${lines}. Очки: ${score}.\n\n` +
        'Ваша скидка 5% сохранена — сделайте скриншот этого экрана и отправьте при заказе.';
      startBtn.textContent = 'Играть снова';
    }

    function drawBackground() {
      const grd = ctx.createLinearGradient(0, 0, 0, VAN.h);
      grd.addColorStop(0, '#1e293b');
      grd.addColorStop(0.55, '#334155');
      grd.addColorStop(1, '#1a1a1a');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, VAN.w, VAN.h);

      ctx.fillStyle = '#2a2a2a';
      ctx.fillRect(0, VAN.floorY + 38, VAN.w, VAN.h - VAN.floorY - 38);
      ctx.fillStyle = '#3a3a3a';
      ctx.fillRect(0, VAN.floorY + 38, VAN.w, 6);
    }

    function drawWheel(cx, cy, r) {
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#333';
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#555';
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.2, 0, Math.PI * 2);
      ctx.fill();
    }

    function drawGazelleBody() {
      ctx.save();

      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(380, VAN.floorY + 42, 280, 12, 0, 0, Math.PI * 2);
      ctx.fill();

      // Cargo box — main body (Gazelle Next style side view)
      const cargoPath = new Path2D();
      cargoPath.moveTo(138, 118);
      cargoPath.lineTo(138, VAN.floorY + 8);
      cargoPath.lineTo(708, VAN.floorY + 8);
      cargoPath.lineTo(708, 118);
      cargoPath.lineTo(680, 92);
      cargoPath.lineTo(160, 92);
      cargoPath.closePath();

      ctx.fillStyle = '#e8eaed';
      ctx.fill(cargoPath);
      ctx.strokeStyle = '#9aa3ad';
      ctx.lineWidth = 2;
      ctx.stroke(cargoPath);

      // Orange stripe (brand)
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(145, 248, 558, 10);

      // Cargo door lines
      ctx.strokeStyle = 'rgba(0,0,0,0.12)';
      ctx.lineWidth = 1;
      for (let i = 1; i < 5; i++) {
        const lx = 160 + i * 110;
        ctx.beginPath();
        ctx.moveTo(lx, 100);
        ctx.lineTo(lx, VAN.floorY);
        ctx.stroke();
      }

      // Cab
      ctx.fillStyle = '#dfe3e8';
      ctx.beginPath();
      ctx.moveTo(8, VAN.floorY + 8);
      ctx.lineTo(8, 200);
      ctx.lineTo(30, 148);
      ctx.lineTo(78, 108);
      ctx.lineTo(138, 98);
      ctx.lineTo(138, VAN.floorY + 8);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#9aa3ad';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Windshield
      ctx.fillStyle = 'rgba(100,160,210,0.55)';
      ctx.beginPath();
      ctx.moveTo(36, 158);
      ctx.lineTo(82, 118);
      ctx.lineTo(118, 112);
      ctx.lineTo(118, 198);
      ctx.lineTo(36, 218);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.stroke();

      // Side window
      ctx.fillStyle = 'rgba(100,160,210,0.45)';
      ctx.fillRect(22, 168, 48, 42);
      ctx.strokeRect(22, 168, 48, 42);

      // Headlight
      ctx.fillStyle = '#fef9c3';
      ctx.beginPath();
      ctx.arc(14, 248, 10, 0, Math.PI * 2);
      ctx.fill();

      // Bumper
      ctx.fillStyle = '#444';
      ctx.fillRect(4, VAN.floorY - 4, 28, 14);

      // Rear bumper + lights
      ctx.fillStyle = '#444';
      ctx.fillRect(698, VAN.floorY - 2, 18, 12);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(704, 268, 8, 22);
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(704, 300, 8, 14);

      // Wheel arches
      ctx.fillStyle = '#e8eaed';
      ctx.beginPath();
      ctx.arc(118, VAN.floorY + 8, 34, Math.PI, 0);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(620, VAN.floorY + 8, 38, Math.PI, 0);
      ctx.fill();

      drawWheel(118, VAN.floorY + 32, 30);
      drawWheel(620, VAN.floorY + 32, 32);

      // Open rear doors (view into cargo from side cutaway)
      ctx.fillStyle = 'rgba(245,158,11,0.85)';
      ctx.font = '700 11px Manrope, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('ГАЗЕЛЬ NEXT', 420, 62);

      ctx.restore();
    }

    function drawCargoInterior() {
      // Cutaway — interior visible from side
      ctx.save();

      ctx.fillStyle = '#2c2418';
      ctx.fillRect(VAN.cargoX, VAN.cargoY + VAN.cargoH - 8, VAN.cargoW, 10);

      const floorGrd = ctx.createLinearGradient(VAN.cargoX, VAN.cargoY, VAN.cargoX, VAN.cargoY + VAN.cargoH);
      floorGrd.addColorStop(0, 'rgba(30,25,20,0.92)');
      floorGrd.addColorStop(1, 'rgba(45,38,30,0.95)');
      ctx.fillStyle = floorGrd;
      ctx.fillRect(VAN.cargoX, VAN.cargoY, VAN.cargoW, VAN.cargoH);

      // Side wall depth (back wall visible at rear)
      const wallGrd = ctx.createLinearGradient(VAN.cargoX + VAN.cargoW - 40, 0, VAN.cargoX + VAN.cargoW, 0);
      wallGrd.addColorStop(0, 'transparent');
      wallGrd.addColorStop(1, 'rgba(0,0,0,0.35)');
      ctx.fillStyle = wallGrd;
      ctx.fillRect(VAN.cargoX + VAN.cargoW - 40, VAN.cargoY, 40, VAN.cargoH);

      // Ceiling
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      ctx.fillRect(VAN.cargoX, VAN.cargoY, VAN.cargoW, 6);

      // Subtle grid
      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.lineWidth = 1;
      for (let c = 0; c <= COLS; c++) {
        ctx.beginPath();
        ctx.moveTo(VAN.cargoX + c * CELL_W, VAN.cargoY);
        ctx.lineTo(VAN.cargoX + c * CELL_W, VAN.cargoY + VAN.cargoH);
        ctx.stroke();
      }
      for (let r = 0; r <= ROWS; r++) {
        ctx.beginPath();
        ctx.moveTo(VAN.cargoX, VAN.cargoY + r * CELL_H);
        ctx.lineTo(VAN.cargoX + VAN.cargoW, VAN.cargoY + r * CELL_H);
        ctx.stroke();
      }

      // Label
      ctx.fillStyle = 'rgba(245,158,11,0.75)';
      ctx.font = '600 10px Manrope, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('Вид в кузов сбоку ↑', VAN.cargoX + 8, VAN.cargoY - 8);

      ctx.strokeStyle = 'rgba(245,158,11,0.5)';
      ctx.lineWidth = 2;
      ctx.strokeRect(VAN.cargoX, VAN.cargoY, VAN.cargoW, VAN.cargoH);

      ctx.restore();
    }

    function drawCargoItem(col, row, info, alpha = 1) {
      const { x, y, w, h } = gridToScreen(col, row);
      const pad = 2;
      const ix = x + pad;
      const iy = y + pad;
      const iw = w - pad * 2;
      const ih = h - pad * 2;
      const depth = Math.min(8, ih * 0.18);

      ctx.save();
      ctx.globalAlpha = alpha;

      // Side face (main — we look at cargo from the side)
      ctx.fillStyle = info.edge || info.color;
      ctx.fillRect(ix, iy + depth, iw, ih - depth);

      // Top face (3D depth from side perspective)
      ctx.fillStyle = info.color;
      ctx.beginPath();
      ctx.moveTo(ix, iy + depth);
      ctx.lineTo(ix + depth * 0.6, iy);
      ctx.lineTo(ix + iw + depth * 0.6, iy);
      ctx.lineTo(ix + iw, iy + depth);
      ctx.closePath();
      ctx.fill();

      // Front edge highlight
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(ix, iy + depth, 3, ih - depth);

      // Item-specific side details
      ctx.strokeStyle = 'rgba(0,0,0,0.2)';
      ctx.lineWidth = 1;
      if (info.key === 'I') {
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.fillRect(ix + 4, iy + depth + ih * 0.35, iw - 8, ih * 0.18);
      } else if (info.key === 'O') {
        ctx.strokeRect(ix + 4, iy + depth + 4, iw - 8, ih - depth - 8);
        ctx.beginPath();
        ctx.moveTo(ix + 4, iy + depth + 4);
        ctx.lineTo(ix + iw - 4, iy + depth + ih - depth - 4);
        ctx.stroke();
      } else if (info.key === 'T' || info.key === 'J' || info.key === 'L') {
        ctx.strokeRect(ix + 3, iy + depth + 3, iw - 6, ih - depth - 6);
        for (let d = 1; d < 3; d++) {
          ctx.beginPath();
          ctx.moveTo(ix + 3, iy + depth + (ih - depth) * d / 3);
          ctx.lineTo(ix + iw - 3, iy + depth + (ih - depth) * d / 3);
          ctx.stroke();
        }
      }

      ctx.font = `${Math.min(iw, ih) * 0.42}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(info.emoji, ix + iw / 2, iy + depth + (ih - depth) / 2);

      ctx.restore();
    }

    function drawBoard() {
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (board[r][c]) drawCargoItem(c, r, board[r][c]);
        }
      }
    }

    function drawCurrent() {
      if (!current) return;
      const info = PIECES[current.key];
      const cells = getCells(current);
      for (let r = 0; r < cells.length; r++) {
        for (let c = 0; c < cells[r].length; c++) {
          if (cells[r][c] && current.row + r >= 0) {
            drawCargoItem(current.col + c, current.row + r, { ...info, key: current.key });
          }
        }
      }
      const ghost = { ...current };
      while (!collides(ghost, 1, 0)) ghost.row++;
      const ghostCells = getCells(ghost);
      for (let r = 0; r < ghostCells.length; r++) {
        for (let c = 0; c < ghostCells[r].length; c++) {
          if (ghostCells[r][c] && ghost.row + r >= 0) {
            drawCargoItem(ghost.col + c, ghost.row + r, { ...info, key: current.key }, 0.25);
          }
        }
      }
    }

    function drawNext() {
      if (!next) return;
      nextCtx.clearRect(0, 0, 120, 120);
      nextCtx.fillStyle = '#1a2234';
      nextCtx.fillRect(0, 0, 120, 120);
      nextCtx.fillStyle = 'rgba(245,158,11,0.6)';
      nextCtx.font = '600 9px Manrope,sans-serif';
      nextCtx.textAlign = 'center';
      nextCtx.fillText('Сбоку', 60, 12);

      const cells = getCells({ key: next.key, rotation: 0 });
      const info = PIECES[next.key];
      const size = 18;
      const pw = cells[0].length * size;
      const ph = cells.length * size;
      const ox = (120 - pw) / 2;
      const oy = (120 - ph) / 2 + 8;

      for (let r = 0; r < cells.length; r++) {
        for (let c = 0; c < cells[r].length; c++) {
          if (!cells[r][c]) continue;
          const x = ox + c * size;
          const y = oy + r * size;
          nextCtx.fillStyle = info.edge;
          nextCtx.fillRect(x + 1, y + 4, size - 2, size - 5);
          nextCtx.fillStyle = info.color;
          nextCtx.fillRect(x + 1, y + 1, size - 2, 4);
          nextCtx.font = '11px serif';
          nextCtx.textAlign = 'center';
          nextCtx.fillText(info.emoji, x + size / 2, y + size / 2 + 2);
        }
      }
    }

    function draw() {
      ctx.clearRect(0, 0, VAN.w, VAN.h);
      drawBackground();
      drawGazelleBody();
      drawCargoInterior();
      drawBoard();
      drawCurrent();
    }

    function gameLoop(time) {
      if (gameRunning && !paused) {
        if (time - lastDrop > dropInterval) {
          move('down');
          lastDrop = time;
        }
        draw();
      }
      requestAnimationFrame(gameLoop);
    }

    function showOverlay(title, text, btnText) {
      rewardEl.hidden = true;
      overlayEl.hidden = false;
      overlayTitleEl.textContent = title;
      overlayTextEl.textContent = text;
      startBtn.textContent = btnText;
    }

    function hideOverlay() {
      overlayEl.hidden = true;
    }

    function startGame() {
      board = emptyBoard();
      score = 0;
      lines = 0;
      level = 1;
      dropInterval = 650;
      lastDrop = performance.now();
      paused = false;
      pausedForReward = false;
      discountUnlocked = false;
      gameRunning = true;
      next = null;
      hideOverlay();
      spawnPiece();
      updateHUD();
      draw();
    }

    function endGame() {
      gameRunning = false;
      if (discountUnlocked) {
        showDiscountEnd();
        return;
      }
      showOverlay(
        'Газель переполнена!',
        `Упаковано рядов: ${lines}. Очки: ${score}. Попробуйте ещё!`,
        'Играть снова'
      );
    }

    function togglePause() {
      if (!gameRunning) return;
      paused = !paused;
      if (paused) {
        showOverlay('Пауза', 'Нажмите «Продолжить».', 'Продолжить');
      } else {
        hideOverlay();
      }
    }

    function handleGameAction(action) {
      if (action === 'pause') {
        if (gameRunning) togglePause();
        return;
      }

      if (!gameRunning) startGame();
      if (!gameRunning || paused) return;

      switch (action) {
        case 'left': move('left'); break;
        case 'right': move('right'); break;
        case 'down': move('down'); break;
        case 'rotate': rotate(); break;
        case 'drop': hardDrop(); break;
      }
      draw();
    }

    document.addEventListener('keydown', (e) => {
      if (gameRunning && ['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', ' '].includes(e.key)) {
        e.preventDefault();
      }
      if (!gameRunning && e.key === 'Enter') {
        startGame();
        return;
      }
      switch (e.key) {
        case 'ArrowLeft': move('left'); break;
        case 'ArrowRight': move('right'); break;
        case 'ArrowDown': move('down'); break;
        case 'ArrowUp': rotate(); break;
        case ' ': hardDrop(); break;
        case 'p': case 'P': togglePause(); break;
      }
      if (gameRunning) draw();
    });

    startBtn.addEventListener('click', () => {
      if (gameRunning && paused) {
        paused = false;
        pausedForReward = false;
        hideOverlay();
      } else {
        startGame();
      }
    });

    document.querySelectorAll('[data-game]').forEach(btn => {
      const action = btn.dataset.game;

      const press = (e) => {
        e.preventDefault();
        btn.classList.add('is-pressed');
        handleGameAction(action);
      };

      const release = () => {
        btn.classList.remove('is-pressed');
      };

      btn.addEventListener('pointerdown', press);
      btn.addEventListener('pointerup', release);
      btn.addEventListener('pointerleave', release);
      btn.addEventListener('pointercancel', release);
    });

    let swipeStart = null;

    canvas.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      swipeStart = { x: e.clientX, y: e.clientY };
    });

    canvas.addEventListener('pointerup', (e) => {
      if (!swipeStart) return;

      const dx = e.clientX - swipeStart.x;
      const dy = e.clientY - swipeStart.y;
      swipeStart = null;

      if (e.pointerType === 'mouse') return;

      const absX = Math.abs(dx);
      const absY = Math.abs(dy);

      if (absX < 20 && absY < 20) {
        handleGameAction('rotate');
        return;
      }

      if (!gameRunning) startGame();
      if (!gameRunning || paused) return;

      if (absX > absY) {
        move(dx > 0 ? 'right' : 'left');
      } else if (dy > 0) {
        if (dy > 70) hardDrop();
        else move('down');
      }
      draw();
    });

    board = emptyBoard();
    current = null;
    gameRunning = false;
    draw();
    showOverlay(
      'Упакуй Газель!',
      'Вид сбоку в кузов: груз падает сверху вниз. Заполните ряд по всей длине — он упакуется. Нажмите «Начать игру».',
      'Начать игру'
    );
    requestAnimationFrame(gameLoop);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGame);
  } else {
    initGame();
  }
})();
